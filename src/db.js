import { MongoClient } from "mongodb";

let clientPromise;

function getClientPromise() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI env var is not set");
  }
  // Reuse the client (and its connection pool) across invocations —
  // serverless functions can stay warm between calls, and creating a new
  // MongoClient every time exhausts Atlas's connection limit fast.
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClientPromise();
  return client.db();
}

export async function getListingsCollection() {
  const db = await getDb();
  const collection = db.collection("listings");
  await collection.createIndex(
    { source: 1, sourceId: 1 },
    { unique: true }
  );
  await collection.createIndex({ normalizedKey: 1 });
  return collection;
}

export async function getMetaCollection() {
  const db = await getDb();
  return db.collection("meta");
}

const META_DOC_ID = "state";

export async function getState() {
  const meta = await getMetaCollection();
  const doc = await meta.findOne({ _id: META_DOC_ID });
  return doc || { _id: META_DOC_ID, hasRunBefore: false, lastDigestDate: null };
}

export async function saveState(update) {
  const meta = await getMetaCollection();
  await meta.updateOne(
    { _id: META_DOC_ID },
    { $set: update },
    { upsert: true }
  );
}
