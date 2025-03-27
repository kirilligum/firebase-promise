// example.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const { wrapTaskWithOrchestration } = require("firestore-promise");

// Each task function is defined inline as an anonymous function passed to the orchestration wrapper.
// The task logic receives (snap, context, dependencyOutputs) and appends its own message
// to the concatenated outputs from its parent tasks.

// Task A: Root task with no parents. Its child tasks are TaskB and TaskC.
exports.taskA = functions.firestore.document("tasks/taskA").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskA...");
      return `${dependencyOutputs.join(" ")}TaskA completed`;
    },
    [], // No parentTaskIds.
    ["taskB", "taskC"], // Child task IDs.
  ),
);

// Task B: Depends on TaskA; its child is TaskD.
exports.taskB = functions.firestore.document("tasks/taskB").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskB...");
      return `${dependencyOutputs.join(" ")} TaskB completed`;
    },
    ["taskA"], // Depends on TaskA.
    ["taskD"], // Child task IDs.
  ),
);

// Task C: Depends on TaskA; its child is TaskE.
exports.taskC = functions.firestore.document("tasks/taskC").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskC...");
      return `${dependencyOutputs.join(" ")} TaskC completed`;
    },
    ["taskA"], // Depends on TaskA.
    ["taskE"], // Child task IDs.
  ),
);

// Task D: Depends on TaskB; its child is TaskE.
exports.taskD = functions.firestore.document("tasks/taskD").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskD...");
      return `${dependencyOutputs.join(" ")} TaskD completed`;
    },
    ["taskB"], // Depends on TaskB.
    ["taskE"], // Child task IDs.
  ),
);

// Task E: Depends on both TaskC and TaskD; no child tasks.
exports.taskE = functions.firestore.document("tasks/taskE").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskE...");
      return `${dependencyOutputs.join(" ")} TaskE completed`;
    },
    ["taskC", "taskD"], // Depends on TaskC and TaskD.
    [], // No child tasks.
  ),
);
