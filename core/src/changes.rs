//! The change log: every edit to a record is an add-only change, so devices that edit
//! offline never overwrite each other. Current state is a pure fold (`merge`) over the log.
//!
//! Generic over the kind of record: a record type lists its fields and how an edit
//! applies (`Record`); the log, ordering, deletion and conflict rules live here once.
//!
//! Each change names the record's latest changes the device had seen (`parents`). That
//! makes the log a graph per record: a change that descends from another came after it,
//! and two changes where neither descends from the other were made concurrently. Two
//! concurrent changes to the same field are a real conflict, which the user resolves.
//! Deleting is a change too (a tombstone), so a delete and a concurrent edit can be caught.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use tsify::Tsify;

/// A kind of record kept in the change log.
pub trait Record: Default {
    /// One field set to a new value.
    type Edit: Clone + PartialEq;
    /// Names the fields; edits to the same field compete.
    type Field: Copy + Ord + Serialize;

    fn field(edit: &Self::Edit) -> Self::Field;
    fn apply(&mut self, edit: &Self::Edit);
}

/// What a change does: set one field, or delete (or undelete) the record.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "op", content = "value", rename_all = "camelCase")]
pub enum Edit<E> {
    Set(E),
    Deleted(bool),
}

/// The field an edit competes on; `None` is the record's deleted flag.
fn slot<R: Record>(edit: &Edit<R::Edit>) -> Option<R::Field> {
    match edit {
        Edit::Deleted(_) => None,
        Edit::Set(e) => Some(R::field(e)),
    }
}

/// One recorded edit.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Change<E> {
    /// Unique: `<device>.<at>.<n>`, n counting the edits made together.
    pub id: String,
    pub record_id: String,
    /// The record's latest changes on this device when the edit was made.
    pub parents: Vec<String>,
    /// Milliseconds since the Unix epoch, on the editing device's clock. Only used to pick
    /// a provisional value while a conflict waits for the user.
    pub at: f64,
    pub device: String,
    pub edit: Edit<E>,
}

/// When and where a batch of edits is made.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Stamp {
    pub at: f64,
    pub device: String,
}

/// One record as the log says it is now.
#[derive(Debug, PartialEq)]
pub struct Merged<R: Record> {
    pub id: String,
    pub record: R,
    pub deleted: bool,
    /// Fields (or the deleted flag) set to different values concurrently on two devices:
    /// the competing changes, newest first. The record holds the first until the user picks.
    pub clashes: Vec<Vec<Change<R::Edit>>>,
    /// Deleted on one device while another was still changing it.
    pub deleted_while_edited: bool,
}

/// The record's changes that no later change builds on: what a new edit's parents are.
pub fn heads<E>(changes: &[Change<E>], record_id: &str) -> Vec<String> {
    let of_record: Vec<&Change<E>> = changes
        .iter()
        .filter(|c| c.record_id == record_id)
        .collect();
    let superseded: BTreeSet<&str> = of_record
        .iter()
        .flat_map(|c| c.parents.iter().map(String::as_str))
        .collect();
    let mut heads: Vec<String> = of_record
        .iter()
        .filter(|c| !superseded.contains(c.id.as_str()))
        .map(|c| c.id.clone())
        .collect();
    heads.sort();
    heads.dedup();
    heads
}

/// The changes that record `edits` to one record, building on everything seen so far.
pub fn record<E>(
    changes: &[Change<E>],
    record_id: &str,
    edits: Vec<Edit<E>>,
    stamp: &Stamp,
) -> Vec<Change<E>> {
    let parents = heads(changes, record_id);
    edits
        .into_iter()
        .enumerate()
        .map(|(n, edit)| Change {
            id: format!("{}.{}.{n}", stamp.device, stamp.at),
            record_id: record_id.to_string(),
            parents: parents.clone(),
            at: stamp.at,
            device: stamp.device.clone(),
            edit,
        })
        .collect()
}

/// Replays the log into every record it mentions, deleted ones included.
pub fn merge<R: Record>(changes: &[Change<R::Edit>]) -> Vec<Merged<R>> {
    let mut by_record: BTreeMap<&str, Vec<&Change<R::Edit>>> = BTreeMap::new();
    let mut seen = BTreeSet::new();
    // The same change can arrive twice (a retried save); keep one of each id.
    for change in changes.iter().filter(|c| seen.insert(&c.id)) {
        by_record.entry(&change.record_id).or_default().push(change);
    }
    by_record
        .into_iter()
        .map(|(id, changes)| merge_one::<R>(id, &changes))
        .collect()
}

fn merge_one<R: Record>(id: &str, changes: &[&Change<R::Edit>]) -> Merged<R> {
    let history = History::new(changes);
    let mut slots: BTreeSet<Option<R::Field>> = BTreeSet::new();
    slots.extend(changes.iter().map(|c| slot::<R>(&c.edit)));

    let mut merged = Merged {
        id: id.to_string(),
        record: R::default(),
        deleted: false,
        clashes: Vec::new(),
        deleted_while_edited: false,
    };
    for slot_key in slots {
        let latest = history.latest(|c| slot::<R>(&c.edit) == slot_key);
        match &latest[0].edit {
            Edit::Set(e) => merged.record.apply(e),
            Edit::Deleted(d) => merged.deleted = *d,
        }
        // Two devices making the same edit agree; only differing values clash.
        if latest.iter().any(|c| c.edit != latest[0].edit) {
            merged
                .clashes
                .push(latest.iter().map(|c| (*c).clone()).collect());
        }
    }
    merged.deleted_while_edited = history
        .latest(|c| matches!(c.edit, Edit::Deleted(_)))
        .iter()
        .filter(|d| d.edit == Edit::Deleted(true))
        .any(|d| history.has_concurrent_edit(d));
    merged
}

/// One record's changes, with who came after whom.
struct History<'a, E> {
    changes: &'a [&'a Change<E>],
    /// Every change's ancestors, by id.
    ancestors: BTreeMap<&'a str, BTreeSet<&'a str>>,
}

impl<'a, E: PartialEq> History<'a, E> {
    fn new(changes: &'a [&'a Change<E>]) -> Self {
        let by_id: BTreeMap<&str, &Change<E>> =
            changes.iter().map(|c| (c.id.as_str(), *c)).collect();
        let mut ancestors = BTreeMap::new();
        for change in changes {
            let mut seen = BTreeSet::new();
            let mut todo: Vec<&str> = change.parents.iter().map(String::as_str).collect();
            while let Some(id) = todo.pop() {
                if seen.insert(id) {
                    if let Some(parent) = by_id.get(id) {
                        todo.extend(parent.parents.iter().map(String::as_str));
                    }
                }
            }
            ancestors.insert(change.id.as_str(), seen);
        }
        History { changes, ancestors }
    }

    fn is_before(&self, earlier: &Change<E>, later: &Change<E>) -> bool {
        self.ancestors[later.id.as_str()].contains(earlier.id.as_str())
    }

    /// The matching changes that no later matching change replaced, newest first. More
    /// than one means they were made concurrently.
    fn latest(&self, matches: impl Fn(&Change<E>) -> bool) -> Vec<&'a Change<E>> {
        let candidates: Vec<&Change<E>> = self
            .changes
            .iter()
            .copied()
            .filter(|c| matches(c))
            .collect();
        let mut latest: Vec<&Change<E>> = candidates
            .iter()
            .copied()
            .filter(|c| !candidates.iter().any(|d| self.is_before(c, d)))
            .collect();
        latest.sort_by(|a, b| b.at.total_cmp(&a.at).then_with(|| b.id.cmp(&a.id)));
        latest
    }

    /// Whether some field was set without knowing about `change`.
    fn has_concurrent_edit(&self, change: &Change<E>) -> bool {
        self.changes.iter().any(|c| {
            matches!(c.edit, Edit::Set(_))
                && !self.is_before(c, change)
                && !self.is_before(change, c)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A record with nothing to do with items: one counter-like text field.
    #[derive(Default, Debug, PartialEq)]
    struct Note {
        text: String,
    }

    impl Record for Note {
        type Edit = String;
        type Field = ();
        fn field(_: &String) {}
        fn apply(&mut self, edit: &String) {
            self.text = edit.clone();
        }
    }

    fn at(device: &str, at: f64) -> Stamp {
        Stamp {
            at,
            device: device.to_string(),
        }
    }

    #[test]
    fn any_kind_of_record_merges_and_flags_clashes_the_same_way() {
        let mut log = record(&[], "n", vec![Edit::Set("hi".to_string())], &at("a", 1.0));
        let seen = log.clone();
        log.extend(record(
            &seen,
            "n",
            vec![Edit::Set("one".into())],
            &at("a", 2.0),
        ));
        log.extend(record(
            &seen,
            "n",
            vec![Edit::Set("two".into())],
            &at("b", 3.0),
        ));
        let [merged] = merge::<Note>(&log).try_into().unwrap();
        assert_eq!(merged.record.text, "two");
        assert_eq!(merged.clashes.len(), 1);
        assert!(!merged.deleted);
    }

    #[test]
    fn the_same_edit_made_on_two_devices_is_not_a_clash() {
        let mut log = record(&[], "n", vec![Edit::Set("hi".to_string())], &at("a", 1.0));
        let seen = log.clone();
        log.extend(record(&seen, "n", vec![Edit::Deleted(true)], &at("a", 2.0)));
        log.extend(record(&seen, "n", vec![Edit::Deleted(true)], &at("b", 3.0)));
        let [merged] = merge::<Note>(&log).try_into().unwrap();
        assert!(merged.deleted);
        assert!(merged.clashes.is_empty());
    }
}
