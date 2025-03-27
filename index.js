// index.js
const admin = require('firebase-admin');
admin.initializeApp();
const functions = require('firebase-functions');

/**
 * Alerts errors to developers.
 */
function alertError(message, error) {
  console.error(`Developer Alert: ${message}`, error);
}

/**
 * Retries an asynchronous operation with exponential backoff.
 */
async function retryOperation(fn, attempts = 3, delay = 1000) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

/**
 * Sets the task status in Firestore.
 */
async function setTaskStatus(taskId, status, data = {}) {
  return retryOperation(() => {
    return admin.firestore().collection('tasks').doc(taskId).set({
      status,
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }, 3, 1000).catch((error) => {
    alertError(`Failed to set status for ${taskId} to ${status}`, error);
    throw error;
  });
}

/**
 * Atomically updates a task document using a Firestore batch.
 */
async function updateTaskAtomically(taskId, updateData) {
  const taskRef = admin.firestore().collection('tasks').doc(taskId);
  const batch = admin.firestore().batch();
  const dataWithTimestamp = {
    ...updateData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  batch.set(taskRef, dataWithTimestamp, { merge: true });
  await batch.commit();
}

/**
 * Fetches outputs from dependency (parent) tasks.
 */
async function fetchDependencyOutputs(parentTaskIds) {
  const taskRefs = parentTaskIds.map(taskId =>
    admin.firestore().collection('tasks').doc(taskId)
  );
  const taskDocs = await admin.firestore().getAll(...taskRefs);
  return taskDocs.map(doc => {
    const data = doc.data();
    return data ? (data.output || "") : "";
  });
}

/**
 * Triggers child tasks for a given task if they are still queued.
 */
async function triggerChildTasksForTask(completedTaskId) {
  console.log(`Triggering child tasks for completed task: ${completedTaskId}`);
  try {
    const taskDoc = await admin.firestore().collection('tasks').doc(completedTaskId).get();
    const taskData = taskDoc.data();
    if (!taskData || !taskData.nextTasks) {
      console.log(`No child tasks for task: ${completedTaskId}`);
      return;
    }
    const childTaskIds = taskData.nextTasks;
    for (const childTaskId of childTaskIds) {
      const childTaskDoc = await admin.firestore().collection('tasks').doc(childTaskId).get();
      if (childTaskDoc.exists && childTaskDoc.data().status === 'queued') {
        await updateTaskAtomically(childTaskId, { status: 'processing' });
        console.log(`Child task ${childTaskId} triggered.`);
      }
    }
  } catch (error) {
    alertError(`Error triggering child tasks for ${completedTaskId}`, error);
  }
}

/**
 * Orchestrates a Firestore task with dependency resolution and child task triggering.
 * 
 * New parameter order:
 *   - taskFn: core task logic (receives snap, context, dependencyOutputs)
 *   - parentTaskIds: array of task IDs whose outputs will be gathered and provided to taskFn
 *   - childTaskIds: array of task IDs to trigger after this task
 */
function wrapTaskWithOrchestration(taskFn, parentTaskIds = [], childTaskIds = []) {
  return async (snap, context) => {
    const taskId = context.params.taskId;
    if (!taskId) {
      throw new Error("Task ID is not available in context.params");
    }

    // Atomically update initial state.
    await updateTaskAtomically(taskId, { status: 'queued' });
    await updateTaskAtomically(taskId, { status: 'processing' });

    try {
      // Retrieve dependency outputs if provided.
      const dependencyOutputs = parentTaskIds.length > 0
        ? await fetchDependencyOutputs(parentTaskIds)
        : [];

      // Execute the core task logic.
      const result = await taskFn(snap, context, dependencyOutputs);

      // Atomically update task as fulfilled along with output and child task IDs.
      const updateData = {
        status: 'fulfilled',
        output: result,
        ...(childTaskIds.length > 0 && { nextTasks: childTaskIds })
      };
      await updateTaskAtomically(taskId, updateData);

      // Trigger child tasks.
      await triggerChildTasksForTask(taskId);
      return result;
    } catch (error) {
      await updateTaskAtomically(taskId, { status: 'rejected', error: error.message });
      alertError(`Task ${taskId} failed`, error);
      throw error;
    }
  };
}

module.exports = {
  alertError,
  retryOperation,
  setTaskStatus,
  updateTaskAtomically,
  fetchDependencyOutputs,
  triggerChildTasksForTask,
  wrapTaskWithOrchestration
};

