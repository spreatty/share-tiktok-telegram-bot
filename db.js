const { MongoClient, ObjectId } = require('mongodb');
var client;

module.exports = {
  init: connStr => client = new MongoClient(connStr),
  close: () => client.close(),
  getTargets: async source => (await links().findOne({ _id: source }))?.targets || [],
  findSources: async target => (await links().find({ targets: target }).toArray()).map(doc => doc._id),
  addLink: async (source, target) => {
    const res = await links().updateOne({ _id: source }, { $addToSet: { targets: target } }, { upsert: true });
    return res.upsertedCount > 0 || res.modifiedCount > 0;
  },
  deleteLink: async (source, target) => {
    const res = await links().updateOne({ _id: source }, { $pull: { targets: target } });
    return res.modifiedCount > 0;
  },
  obtainRegistryId: async (chatId, isFromSource) => {
    const res = await registry().findOneAndUpdate({ chatId, isFromSource }, { $setOnInsert: { chatId, isFromSource } }, { upsert: true });
    return (res.lastErrorObject.upserted || res.value._id).toString();
  },
  pullRegistry: async regId => (await registry().findOneAndDelete({ _id: new ObjectId(regId) })).value
};

const links = () => client.db('shareTikTokBot').collection('links');
const registry = () => client.db('shareTikTokBot').collection('registry');
