const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "campusfindy-test-secret-with-at-least-32-characters";

const User = require("../models/User");
const Item = require("../models/Item");
const ClaimRequest = require("../models/ClaimRequest");
const claimRoutes = require("../routes/claimRoutes");
const itemRoutes = require("../routes/itemRoutes");

const claimantId = "111111111111111111111111";
const finderId = "222222222222222222222222";
const itemId = "333333333333333333333333";
const claimId = "444444444444444444444444";
const contactInfo = "finder@example.edu";

const originals = {
  userFindById: User.findById,
  itemFindById: Item.findById,
  itemCreate: Item.create,
  claimFindOne: ClaimRequest.findOne,
  claimFind: ClaimRequest.find,
  claimFindById: ClaimRequest.findById,
  claimFindOneAndUpdate: ClaimRequest.findOneAndUpdate,
  claimUpdateMany: ClaimRequest.updateMany,
  claimCreate: ClaimRequest.create,
  startSession: mongoose.startSession,
  itemFindOneAndUpdate: Item.findOneAndUpdate,
};

let server;
let baseUrl;
let currentItem;
let currentClaim;
let competingClaim;

function queryResult(value) {
  const result = Promise.resolve(value);
  result.select = () => result;
  result.session = () => result;
  return result;
}

function authHeader(userId = claimantId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/claims", claimRoutes);
  app.use("/api/items", itemRoutes);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ message: error.message });
  });

  User.findById = (userId) => ({
    select: async () => ({ _id: userId, status: "active" }),
  });
  Item.findById = () => {
    const result = Promise.resolve(currentItem);
    result.select = () => result;
    return result;
  };
  ClaimRequest.findOne = (query) => {
    const allowedStatuses = query.status?.$in;
    if (
      (allowedStatuses && !allowedStatuses.includes(currentClaim?.status)) ||
      (typeof query.status === "string" &&
        query.status !== currentClaim?.status)
    ) {
      return queryResult(null);
    }

    return queryResult(currentClaim);
  };
  ClaimRequest.find = (query) => {
    const claims =
      currentClaim &&
      String(currentClaim.claimant) === String(query.claimant)
        ? [currentClaim]
        : [];
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      lean: async () => claims,
    };
  };
  ClaimRequest.findById = async () => currentClaim;
  ClaimRequest.findOneAndUpdate = async (query, update) => {
    if (
      !currentClaim ||
      String(currentClaim._id) !== String(query._id) ||
      String(currentClaim.finder) !== String(query.finder) ||
      currentClaim.status !== query.status
    ) {
      return null;
    }

    currentClaim = { ...currentClaim, ...update.$set };
    return currentClaim;
  };
  ClaimRequest.updateMany = async (query, update) => {
    if (
      competingClaim &&
      String(competingClaim.item) === String(query.item) &&
      competingClaim.status === query.status
    ) {
      competingClaim = { ...competingClaim, ...update.$set };
      return { modifiedCount: 1 };
    }

    return { modifiedCount: 0 };
  };
  ClaimRequest.create = async (data) => ({ _id: claimId, ...data });
  Item.findOneAndUpdate = async (query, update) => {
    if (
      !currentItem ||
      String(currentItem._id) !== String(query._id) ||
      String(currentItem.postedBy) !== String(query.postedBy) ||
      currentItem.state !== query.state ||
      currentItem.claimed !== query.claimed ||
      currentItem.approvedClaim != null
    ) {
      return null;
    }

    currentItem = { ...currentItem, ...update.$set };
    return currentItem;
  };
  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
  Item.create = async (data) => ({
    _id: "new-item-id",
    ...data,
    toObject() {
      return { ...this };
    },
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  currentItem = {
    _id: itemId,
    status: "found",
    state: "open",
    claimed: false,
    postedBy: finderId,
    approvedClaim: null,
    contactInfo,
  };
  currentClaim = null;
  competingClaim = null;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  User.findById = originals.userFindById;
  Item.findById = originals.itemFindById;
  Item.create = originals.itemCreate;
  ClaimRequest.findOne = originals.claimFindOne;
  ClaimRequest.find = originals.claimFind;
  ClaimRequest.findById = originals.claimFindById;
  ClaimRequest.findOneAndUpdate = originals.claimFindOneAndUpdate;
  ClaimRequest.updateMany = originals.claimUpdateMany;
  ClaimRequest.create = originals.claimCreate;
  mongoose.startSession = originals.startSession;
  Item.findOneAndUpdate = originals.itemFindOneAndUpdate;
});

test("claim submission does not disclose the finder's contact information", async () => {
  const response = await fetch(`${baseUrl}/claims/${itemId}`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proof: "I can describe the item in detail." }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(body, "contactInfo"), false);
  assert.equal(JSON.stringify(body).includes(contactInfo), false);
});

test("claim submission requires authentication", async () => {
  const response = await fetch(`${baseUrl}/claims/${itemId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proof: "I can describe the item in detail." }),
  });

  assert.equal(response.status, 401);
});

test("claimants can view only their own submitted requests", async () => {
  currentClaim = {
    _id: claimId,
    claimant: claimantId,
    status: "pending",
  };
  const response = await fetch(`${baseUrl}/claims/sent`, {
    headers: authHeader(claimantId),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0]._id, claimId);
  assert.equal(Object.hasOwn(body[0], "contactInfo"), false);
});

test("an item owner cannot claim their own found item", async () => {
  currentItem.postedBy = claimantId;
  const response = await fetch(`${baseUrl}/claims/${itemId}`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proof: "I can describe the item in detail." }),
  });

  assert.equal(response.status, 403);
});

test("item creation does not return private contact or verification answers", async () => {
  const response = await fetch(`${baseUrl}/items`, {
    method: "POST",
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Blue notebook",
      description: "A blue notebook with a campus logo",
      status: "found",
      location: "Library",
      contactInfo,
      verificationQuestion: "What is inside the cover?",
      verificationAnswer: "A name",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(body.item, "contactInfo"), false);
  assert.equal(Object.hasOwn(body.item, "verificationAnswer"), false);
});

test("only the finder can review a claim", async () => {
  currentClaim = {
    _id: claimId,
    finder: finderId,
    item: itemId,
    status: "pending",
  };
  const response = await fetch(`${baseUrl}/claims/${claimId}/review`, {
    method: "PATCH",
    headers: {
      ...authHeader(claimantId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision: "approved" }),
  });

  assert.equal(response.status, 403);
});

test("only one claim can be approved for an item", async () => {
  currentItem.postedBy = claimantId;
  currentClaim = {
    _id: claimId,
    finder: claimantId,
    item: itemId,
    status: "pending",
  };
  competingClaim = {
    _id: "555555555555555555555555",
    finder: claimantId,
    item: itemId,
    status: "pending",
  };
  const firstResponse = await fetch(`${baseUrl}/claims/${claimId}/review`, {
    method: "PATCH",
    headers: {
      ...authHeader(claimantId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision: "approved" }),
  });
  assert.equal(firstResponse.status, 200);
  assert.equal(currentItem.approvedClaim, claimId);
  assert.equal(competingClaim.status, "rejected");
  assert.match(competingClaim.reviewMessage, /another claim was approved/i);

  const secondClaimResponse = await fetch(`${baseUrl}/claims/${itemId}`, {
    method: "POST",
    headers: {
      ...authHeader(finderId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ proof: "I can describe this item." }),
  });
  assert.equal(secondClaimResponse.status, 409);

  currentClaim = competingClaim;
  const secondResponse = await fetch(
    `${baseUrl}/claims/${currentClaim._id}/review`,
    {
      method: "PATCH",
      headers: {
        ...authHeader(claimantId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ decision: "approved" }),
    }
  );
  const secondBody = await secondResponse.json();

  assert.equal(secondResponse.status, 409);
  assert.match(secondBody.message, /another claim was approved/i);
});

test("contact details are available only for approved or returned claims", async () => {
  currentClaim = { _id: claimId, status: "pending" };
  let response = await fetch(`${baseUrl}/items/${itemId}/contact`, {
    headers: authHeader(),
  });
  assert.equal(response.status, 403);

  currentClaim = { _id: claimId, status: "approved" };
  currentItem.approvedClaim = "666666666666666666666666";
  response = await fetch(`${baseUrl}/items/${itemId}/contact`, {
    headers: authHeader(),
  });
  assert.equal(response.status, 403);

  currentItem.approvedClaim = claimId;
  response = await fetch(`${baseUrl}/items/${itemId}/contact`, {
    headers: authHeader(),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { contactInfo });
});
