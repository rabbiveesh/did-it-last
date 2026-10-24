//! Items in the change log: their fields, and the list and conflicts the log adds up to.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

use crate::changes::{self, Change, Edit, Record};
use crate::items::Item;

/// One field of an item, set to a new value.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "field", content = "value", rename_all = "camelCase")]
pub enum ItemEdit {
    Name(String),
    BoughtOn(#[tsify(type = "string")] NaiveDate),
    EndedOn(#[tsify(type = "string | null")] Option<NaiveDate>),
}

#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "camelCase")]
pub enum ItemField {
    Name,
    BoughtOn,
    EndedOn,
}

/// A change to an item, as the app and storage see it.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(transparent)]
pub struct ItemChange(pub Change<ItemEdit>);

/// An edit to an item: one field, or deleting it.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(transparent)]
pub struct ItemOp(pub Edit<ItemEdit>);

/// An item part-way through the log; it exists once it has a name and a purchase date.
#[derive(Default, Debug, PartialEq)]
pub struct ItemDraft {
    name: Option<String>,
    bought_on: Option<NaiveDate>,
    ended_on: Option<NaiveDate>,
}

impl Record for ItemDraft {
    type Edit = ItemEdit;
    type Field = ItemField;

    fn field(edit: &ItemEdit) -> ItemField {
        match edit {
            ItemEdit::Name(_) => ItemField::Name,
            ItemEdit::BoughtOn(_) => ItemField::BoughtOn,
            ItemEdit::EndedOn(_) => ItemField::EndedOn,
        }
    }

    fn apply(&mut self, edit: &ItemEdit) {
        match edit {
            ItemEdit::Name(name) => self.name = Some(name.clone()),
            ItemEdit::BoughtOn(date) => self.bought_on = Some(*date),
            ItemEdit::EndedOn(date) => self.ended_on = *date,
        }
    }
}

impl ItemDraft {
    fn finish(self, id: &str) -> Option<Item> {
        Some(Item {
            id: id.to_string(),
            name: self.name?,
            bought_on: self.bought_on?,
            ended_on: self.ended_on,
        })
    }
}

/// Something the user has to settle because two devices disagreed.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Conflict {
    /// The same field was changed on two devices; `options` are the competing changes,
    /// newest first. The item shows the first until the user picks.
    #[serde(rename_all = "camelCase")]
    Field {
        item_id: String,
        options: Vec<ItemChange>,
    },
    /// One device deleted the item while another was still changing (or restoring) it.
    /// The item stays in the list until the user decides.
    #[serde(rename_all = "camelCase")]
    DeletedWhileEdited { item_id: String },
}

/// The list as the change log says it is now.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Ledger {
    pub items: Vec<Item>,
    pub conflicts: Vec<Conflict>,
}

/// Replays the log into the current list and the conflicts waiting for the user.
pub fn ledger(changes: &[Change<ItemEdit>]) -> Ledger {
    let mut ledger = Ledger {
        items: Vec::new(),
        conflicts: Vec::new(),
    };
    for merged in changes::merge::<ItemDraft>(changes) {
        let mut keep_or_delete = merged.deleted_while_edited;
        for options in merged.clashes {
            if options.iter().any(|c| matches!(c.edit, Edit::Deleted(_))) {
                // Deleted on one device, restored on another: the same keep-or-delete call.
                keep_or_delete = true;
            } else {
                ledger.conflicts.push(Conflict::Field {
                    item_id: merged.id.clone(),
                    options: options.into_iter().map(ItemChange).collect(),
                });
            }
        }
        if keep_or_delete {
            ledger.conflicts.push(Conflict::DeletedWhileEdited {
                item_id: merged.id.clone(),
            });
        }
        if !merged.deleted || keep_or_delete {
            ledger.items.extend(merged.record.finish(&merged.id));
        }
    }
    ledger
}

/// The edits that turn `before` (none for a new item) into `after`.
pub fn item_edits(before: Option<&Item>, after: &Item) -> Vec<Edit<ItemEdit>> {
    let mut edits = Vec::new();
    if before.map(|b| &b.name) != Some(&after.name) {
        edits.push(ItemEdit::Name(after.name.clone()));
    }
    if before.map(|b| b.bought_on) != Some(after.bought_on) {
        edits.push(ItemEdit::BoughtOn(after.bought_on));
    }
    if before.map(|b| b.ended_on) != Some(after.ended_on) {
        edits.push(ItemEdit::EndedOn(after.ended_on));
    }
    edits.into_iter().map(Edit::Set).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::changes::{heads, record, Stamp};

    fn date(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }

    fn stamp(device: &str, at: f64) -> Stamp {
        Stamp {
            at,
            device: device.to_string(),
        }
    }

    fn kettle() -> Item {
        Item {
            id: "k".to_string(),
            name: "Kettle".to_string(),
            bought_on: date("2026-01-01"),
            ended_on: None,
        }
    }

    /// A log where the phone added the kettle and the laptop has seen it.
    fn added() -> Vec<Change<ItemEdit>> {
        record(&[], "k", item_edits(None, &kettle()), &stamp("phone", 1.0))
    }

    fn edit(
        log: &mut Vec<Change<ItemEdit>>,
        seen: &[Change<ItemEdit>],
        edits: Vec<Edit<ItemEdit>>,
        device: &str,
        at: f64,
    ) {
        let new = record(seen, "k", edits, &stamp(device, at));
        log.extend(new);
    }

    #[test]
    fn a_new_item_appears_in_the_list() {
        let ledger = ledger(&added());
        assert_eq!(ledger.items, vec![kettle()]);
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn a_later_edit_replaces_the_earlier_value() {
        let mut log = added();
        let seen = log.clone();
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Big kettle".into()))],
            "laptop",
            2.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items[0].name, "Big kettle");
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn a_later_edit_wins_even_from_a_device_with_a_slow_clock() {
        let mut log = added();
        let seen = log.clone();
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Big kettle".into()))],
            "laptop",
            0.5,
        );
        assert_eq!(ledger(&log).items[0].name, "Big kettle");
    }

    #[test]
    fn edits_to_different_fields_on_two_devices_both_survive() {
        let mut log = added();
        let seen = log.clone();
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Big kettle".into()))],
            "phone",
            2.0,
        );
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::EndedOn(Some(date("2026-10-01"))))],
            "laptop",
            3.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items[0].name, "Big kettle");
        assert_eq!(ledger.items[0].ended_on, Some(date("2026-10-01")));
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn the_same_field_changed_on_two_devices_asks_the_user_and_shows_the_newest_meanwhile() {
        let mut log = added();
        let seen = log.clone();
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Red kettle".into()))],
            "phone",
            2.0,
        );
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Blue kettle".into()))],
            "laptop",
            3.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items[0].name, "Blue kettle");
        let [Conflict::Field { options, .. }] = ledger.conflicts.as_slice() else {
            panic!("expected one field conflict, got {:?}", ledger.conflicts);
        };
        let values: Vec<&Edit<ItemEdit>> = options.iter().map(|c| &c.0.edit).collect();
        assert_eq!(
            values,
            [
                &Edit::Set(ItemEdit::Name("Blue kettle".into())),
                &Edit::Set(ItemEdit::Name("Red kettle".into()))
            ]
        );
    }

    #[test]
    fn picking_a_value_settles_the_conflict() {
        let mut log = added();
        let seen = log.clone();
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Red kettle".into()))],
            "phone",
            2.0,
        );
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Blue kettle".into()))],
            "laptop",
            3.0,
        );
        let all = log.clone();
        edit(
            &mut log,
            &all,
            vec![Edit::Set(ItemEdit::Name("Red kettle".into()))],
            "laptop",
            4.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items[0].name, "Red kettle");
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn a_deleted_item_leaves_the_list() {
        let mut log = added();
        let seen = log.clone();
        edit(&mut log, &seen, vec![Edit::Deleted(true)], "phone", 2.0);
        let ledger = ledger(&log);
        assert!(ledger.items.is_empty());
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn deleting_on_one_device_while_editing_on_another_asks_the_user() {
        let mut log = added();
        let seen = log.clone();
        edit(&mut log, &seen, vec![Edit::Deleted(true)], "phone", 2.0);
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::EndedOn(Some(date("2026-10-01"))))],
            "laptop",
            3.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items.len(), 1);
        assert_eq!(
            ledger.conflicts,
            [Conflict::DeletedWhileEdited {
                item_id: "k".into()
            }]
        );
    }

    #[test]
    fn deciding_to_delete_after_all_settles_it() {
        let mut log = added();
        let seen = log.clone();
        edit(&mut log, &seen, vec![Edit::Deleted(true)], "phone", 2.0);
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Kettle 2".into()))],
            "laptop",
            3.0,
        );
        let all = log.clone();
        edit(&mut log, &all, vec![Edit::Deleted(true)], "laptop", 4.0);
        let ledger = ledger(&log);
        assert!(ledger.items.is_empty());
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn deciding_to_keep_it_settles_it() {
        let mut log = added();
        let seen = log.clone();
        edit(&mut log, &seen, vec![Edit::Deleted(true)], "phone", 2.0);
        edit(
            &mut log,
            &seen,
            vec![Edit::Set(ItemEdit::Name("Kettle 2".into()))],
            "laptop",
            3.0,
        );
        let all = log.clone();
        edit(&mut log, &all, vec![Edit::Deleted(false)], "laptop", 4.0);
        let ledger = ledger(&log);
        assert_eq!(ledger.items[0].name, "Kettle 2");
        assert!(ledger.conflicts.is_empty());
    }

    #[test]
    fn deleting_on_one_device_while_restoring_on_another_asks_the_user() {
        let mut log = added();
        let seen = log.clone();
        edit(&mut log, &seen, vec![Edit::Deleted(true)], "phone", 2.0);
        let deleted = log.clone();
        edit(&mut log, &deleted, vec![Edit::Deleted(true)], "phone", 3.0);
        edit(
            &mut log,
            &deleted,
            vec![Edit::Deleted(false)],
            "laptop",
            4.0,
        );
        let ledger = ledger(&log);
        assert_eq!(ledger.items.len(), 1);
        assert_eq!(
            ledger.conflicts,
            [Conflict::DeletedWhileEdited {
                item_id: "k".into()
            }]
        );
    }

    #[test]
    fn a_change_saved_twice_counts_once() {
        let mut log = added();
        log.extend(added());
        assert_eq!(ledger(&log).items, vec![kettle()]);
    }

    #[test]
    fn saving_an_unchanged_item_records_nothing() {
        assert!(item_edits(Some(&kettle()), &kettle()).is_empty());
    }

    #[test]
    fn a_new_edit_builds_on_every_change_seen_so_far() {
        let log = added();
        assert_eq!(heads(&log, "k").len(), 3);
        let next = record(&log, "k", vec![Edit::Deleted(true)], &stamp("laptop", 2.0));
        assert_eq!(
            heads(&[log, next.clone()].concat(), "k"),
            vec![next[0].id.clone()]
        );
    }
}
