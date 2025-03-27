# Firestore-Promise

Firestore-Promise is an npm package that provides a robust, Firestore‑based asynchronous orchestration library using promise‑like patterns and atomic batched writes. This package simplifies dependency management between tasks and ensures atomic state transitions in your Firestore-triggered workflows.

## Motivation

Modern Firebase applications often need to coordinate multiple asynchronous tasks with complex dependencies. Traditional methods such as barriers or manual chaining require extra Firestore documents and can introduce boilerplate code as well as potential consistency issues. Firestore-Promise addresses these challenges by:

- **Integrating Dependency Resolution:** Parent task outputs are automatically fetched and passed to dependent tasks.
- **Ensuring Atomicity:** Uses Firestore batched writes to guarantee that state transitions, output storage, and dependency linking occur atomically.
- **Reducing Boilerplate:** Developers focus on writing task logic; the wrapper handles status updates, error handling, dependency fetching, and child task triggering.

## Implementation

### Key Features

- **Orchestration Wrapper:**  
  `wrapTaskWithOrchestration(taskFn, parentTaskIds, childTaskIds)` wraps a task function that receives `(snap, context, dependencyOutputs)`.

  - **parentTaskIds:** An array of task IDs whose outputs are fetched automatically.
  - **childTaskIds:** An array of task IDs to trigger when the current task completes.

- **Atomic Batched Writes:**  
  Uses Firestore batched writes (via `updateTaskAtomically`) to update task status, output, and child task information in one atomic operation.

- **Error Handling and Retries:**  
  Integrated retry logic (`retryOperation`) and error alerting (`alertError`) ensure robust execution even in the face of transient errors.

### Benefits Compared to Other Methods

- **Atomicity:**  
  By committing status updates and child task registrations in one batch, the risk of inconsistent state due to partial writes is minimized.

- **Simplicity:**  
  With dependency resolution and child task triggering built into the wrapper, task functions remain concise and focused solely on business logic.

- **Flexibility:**  
  Each task automatically receives its parent outputs, making it straightforward to compose complex workflows where each task builds on the cumulative output of its predecessors.

## Example Usage

Below is an example of five tasks (A–E) defined as Firebase Cloud Functions. In these examples, the task logic is defined inline within the Firebase trigger using an anonymous function passed to `wrapTaskWithOrchestration`.

```js
// See example.js in this repository.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const { wrapTaskWithOrchestration } = require("firestore-promise");

exports.taskA = functions.firestore.document("tasks/taskA").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskA...");
      return `${dependencyOutputs.join(" ")}TaskA completed`;
    },
    [],
    ["taskB", "taskC"],
  ),
);

exports.taskB = functions.firestore.document("tasks/taskB").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskB...");
      return `${dependencyOutputs.join(" ")} TaskB completed`;
    },
    ["taskA"],
    ["taskD"],
  ),
);

exports.taskC = functions.firestore.document("tasks/taskC").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskC...");
      return `${dependencyOutputs.join(" ")} TaskC completed`;
    },
    ["taskA"],
    ["taskE"],
  ),
);

exports.taskD = functions.firestore.document("tasks/taskD").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskD...");
      return `${dependencyOutputs.join(" ")} TaskD completed`;
    },
    ["taskB"],
    ["taskE"],
  ),
);

exports.taskE = functions.firestore.document("tasks/taskE").onCreate(
  wrapTaskWithOrchestration(
    async (snap, context, dependencyOutputs) => {
      console.log("Executing TaskE...");
      return `${dependencyOutputs.join(" ")} TaskE completed`;
    },
    ["taskC", "taskD"],
    [],
  ),
);
```

## Firestore Security Rules

When deploying this orchestration system, ensure that your Firestore security rules allow the appropriate read and write access for:

- The tasks collection where task status, outputs, and child task IDs are stored.

- Any other collections or documents that the orchestration logic might access.

For example, a basic rule might look like:

```firestore
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Adjust these rules according to your app’s authentication and data access requirements.

## Installation

Install via npm: (in progress)

```bash
npm install firestore-promise
```

Then, import it into your Firebase Cloud Functions project as shown in the example.

```

```
