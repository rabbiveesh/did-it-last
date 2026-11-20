//! Items the user bought, and how long each one lasted (or has lasted so far).

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

/// Something the user bought and wants to watch.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub name: String,
    #[tsify(type = "string")]
    pub bought_on: NaiveDate,
    /// When it broke, wore out or ran out. `None` while it is still going.
    #[tsify(optional, type = "string")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ended_on: Option<NaiveDate>,
}

/// An item as the list shows it.
#[derive(Tsify, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ItemRow {
    pub item: Item,
    /// Whole days from purchase to its end, or to today while it is still going.
    pub days_lasted: i64,
    pub still_going: bool,
}

/// Why an item can't be saved as it is.
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ItemProblem {
    NoName,
    EndedBeforeBought,
}

pub fn item_problem(item: &Item) -> Option<ItemProblem> {
    if item.name.trim().is_empty() {
        Some(ItemProblem::NoName)
    } else if item.ended_on.is_some_and(|end| end < item.bought_on) {
        Some(ItemProblem::EndedBeforeBought)
    } else {
        None
    }
}

pub fn item_row(item: &Item, today: NaiveDate) -> ItemRow {
    let end = item.ended_on.unwrap_or(today);
    ItemRow {
        item: item.clone(),
        days_lasted: (end - item.bought_on).num_days().max(0),
        still_going: item.ended_on.is_none(),
    }
}

/// Every item, still-going ones first, then the most recently bought first.
pub fn item_rows(items: &[Item], today: NaiveDate) -> Vec<ItemRow> {
    let mut rows: Vec<ItemRow> = items.iter().map(|i| item_row(i, today)).collect();
    rows.sort_by(|a, b| {
        b.still_going
            .cmp(&a.still_going)
            .then(b.item.bought_on.cmp(&a.item.bought_on))
            .then_with(|| a.item.name.cmp(&b.item.name))
    });
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }

    fn item(name: &str, bought: &str, ended: Option<&str>) -> Item {
        Item {
            id: name.to_string(),
            name: name.to_string(),
            bought_on: date(bought),
            ended_on: ended.map(date),
        }
    }

    #[test]
    fn an_item_still_going_counts_the_days_up_to_today() {
        let row = item_row(&item("Kettle", "2026-10-01", None), date("2026-10-23"));
        assert_eq!(row.days_lasted, 22);
        assert!(row.still_going);
    }

    #[test]
    fn a_finished_item_shows_how_long_it_lasted() {
        let row = item_row(
            &item("Shoes", "2025-03-01", Some("2026-03-01")),
            date("2026-10-23"),
        );
        assert_eq!(row.days_lasted, 365);
        assert!(!row.still_going);
    }

    #[test]
    fn an_item_bought_today_has_lasted_zero_days() {
        let row = item_row(&item("Pan", "2026-10-23", None), date("2026-10-23"));
        assert_eq!(row.days_lasted, 0);
    }

    #[test]
    fn a_purchase_dated_in_the_future_never_shows_negative_days() {
        let row = item_row(&item("Pan", "2026-11-01", None), date("2026-10-23"));
        assert_eq!(row.days_lasted, 0);
    }

    #[test]
    fn the_list_shows_items_still_going_first_and_newest_purchases_first() {
        let rows = item_rows(
            &[
                item("Old shoes", "2025-01-01", Some("2026-01-01")),
                item("Kettle", "2026-01-01", None),
                item("Vacuum", "2026-06-01", None),
            ],
            date("2026-10-23"),
        );
        let names: Vec<&str> = rows.iter().map(|r| r.item.name.as_str()).collect();
        assert_eq!(names, ["Vacuum", "Kettle", "Old shoes"]);
    }

    #[test]
    fn an_item_needs_a_name() {
        assert_eq!(
            item_problem(&item("  ", "2026-10-01", None)),
            Some(ItemProblem::NoName)
        );
    }

    #[test]
    fn an_item_cannot_end_before_it_was_bought() {
        assert_eq!(
            item_problem(&item("Pan", "2026-10-01", Some("2026-09-30"))),
            Some(ItemProblem::EndedBeforeBought)
        );
        assert_eq!(
            item_problem(&item("Pan", "2026-10-01", Some("2026-10-01"))),
            None
        );
    }
}
