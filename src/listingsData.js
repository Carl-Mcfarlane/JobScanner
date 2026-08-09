import { getListingsCollection, getListingActionsCollection, getState } from "./db.js";
import { groupListings } from "./dedupe.js";
import { sortByPostedAtDesc } from "./format.js";

// Shared data-loading for the homepage / saved / removed views: fetch
// listings + actions from Mongo, dedupe/group, and split by status.
export async function loadGroupedListings() {
  const collection = await getListingsCollection();
  const docs = await collection.find({}).sort({ postedAt: -1 }).limit(500).toArray();

  const actionsCollection = await getListingActionsCollection();
  const actionDocs = await actionsCollection.find({}).toArray();
  const statusByKey = new Map(actionDocs.map((d) => [d._id, d.status]));

  const state = await getState();

  const allGroups = sortByPostedAtDesc(groupListings(docs)).map((g) => ({
    ...g,
    status: statusByKey.get(g.normalizedKey) || null,
  }));

  return {
    // "/" shows everything not removed — saved items stay in the flow
    // there too (with a ★ badge), rather than disappearing once saved.
    activeGroups: allGroups.filter((g) => g.status !== "removed"),
    savedGroups: allGroups.filter((g) => g.status === "saved"),
    removedGroups: allGroups.filter((g) => g.status === "removed"),
    lastRunAt: state.lastRunAt || null,
  };
}
