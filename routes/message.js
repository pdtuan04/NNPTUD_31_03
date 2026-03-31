var express = require("express");
var router = express.Router();
let messageModel = require("../schemas/message");
let { CheckLogin } = require("../utils/authHandler");
let { uploadMessageFile } = require("../utils/uploadHandler");
let mongoose = require("mongoose");

router.get("/:userID", CheckLogin, async function (req, res, next) {
  try {
    let currentUser = req.user;
    let userID = req.params.userID;

    if (!mongoose.Types.ObjectId.isValid(userID)) {
      res.status(404).send({ message: "userID not valid" });
      return;
    }

    let messages = await messageModel.find({
      $or: [
        { from: currentUser._id, to: userID },
        { from: userID, to: currentUser._id }
      ]
    }).sort({ createdAt: 1 });

    res.send(messages);
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});

router.post("/", CheckLogin, function (req, res, next) {
  uploadMessageFile.single("file")(req, res, async function (err) {
    if (err) {
      res.status(400).send({ message: err.message });
      return;
    }

    try {
      let currentUser = req.user;
      let { to, text } = req.body;

      if (!to || !mongoose.Types.ObjectId.isValid(to)) {
        res.status(404).send({ message: "to not valid" });
        return;
      }

      let payload = {
        from: currentUser._id,
        to: to,
        messageContent: {
          type: "text",
          text: ""
        }
      };

      if (req.file) {
        payload.messageContent.type = "file";
        payload.messageContent.text = req.file.path;
      } else {
        if (!text || !text.trim()) {
          res.status(404).send({ message: "text not found" });
          return;
        }
        payload.messageContent.type = "text";
        payload.messageContent.text = text.trim();
      }

      let newMessage = new messageModel(payload);
      newMessage = await newMessage.save();
      res.send(newMessage);
    } catch (error) {
      res.status(404).send({ message: error.message });
    }
  });
});

router.get("/", CheckLogin, async function (req, res, next) {
  try {
    let currentUser = req.user;
    let messages = await messageModel
      .find({
        $or: [{ from: currentUser._id }, { to: currentUser._id }]
      })
      .sort({ createdAt: -1 });

    let seen = new Set();
    let result = [];

    for (let m of messages) {
      let otherUserId =
        String(m.from) === String(currentUser._id) ? String(m.to) : String(m.from);

      if (seen.has(otherUserId)) continue;

      seen.add(otherUserId);
      result.push({
        otherUser: otherUserId,
        lastMessage: m
      });
    }

    res.send(result);
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});
module.exports = router;