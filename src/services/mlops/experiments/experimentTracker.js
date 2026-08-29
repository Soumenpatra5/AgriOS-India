import { openExperimentDb } from "./experimentDb.js";

function uid(prefix = "exp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const experimentTracker = {
  async create({ name, description = "", modelId = null, datasetVersion = null, tags = [] }) {
    const db = await openExperimentDb();
    const experiment = {
      id: uid("exp"),
      name, description, modelId, datasetVersion, tags,
      status: "created",
      params: {},
      hyperparams: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("experiments", "readwrite");
      tx.objectStore("experiments").add(experiment);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return experiment;
  },

  async getAll({ status, modelId } = {}) {
    const db = await openExperimentDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("experiments", "readonly").objectStore("experiments").getAll();
      req.onsuccess = () => {
        let results = (req.result || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (status) results = results.filter((e) => e.status === status);
        if (modelId) results = results.filter((e) => e.modelId === modelId);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getById(id) {
    const db = await openExperimentDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("experiments", "readonly").objectStore("experiments").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async logParams(experimentId, params) {
    const db = await openExperimentDb();
    const exp = await this.getById(experimentId);
    if (!exp) throw new Error(`Experiment ${experimentId} not found`);
    const updated = { ...exp, params: { ...exp.params, ...params }, updatedAt: new Date().toISOString() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("experiments", "readwrite");
      tx.objectStore("experiments").put(updated);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  },

  async logHyperparams(experimentId, hyperparams) {
    const db = await openExperimentDb();
    const exp = await this.getById(experimentId);
    if (!exp) throw new Error(`Experiment ${experimentId} not found`);
    const updated = { ...exp, hyperparams: { ...exp.hyperparams, ...hyperparams }, updatedAt: new Date().toISOString() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("experiments", "readwrite");
      tx.objectStore("experiments").put(updated);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  },

  async createRun(experimentId) {
    const db = await openExperimentDb();
    const run = {
      id: uid("run"),
      experimentId,
      status: "running",
      metrics: {},
      logs: [],
      gpuUsage: null,
      memoryUsage: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction("runs", "readwrite");
      tx.objectStore("runs").add(run);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return run;
  },

  async completeRun(runId, { metrics = {}, status = "completed" } = {}) {
    const db = await openExperimentDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("runs", "readwrite");
      const store = tx.objectStore("runs");
      const req = store.get(runId);
      req.onsuccess = () => {
        const updated = { ...req.result, metrics, status, completedAt: new Date().toISOString() };
        store.put(updated);
        tx.oncomplete = () => resolve(updated);
      };
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getRuns(experimentId) {
    const db = await openExperimentDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("runs", "readonly").objectStore("runs").index("experimentId").getAll(experimentId);
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
      req.onerror = () => reject(req.error);
    });
  },

  /* Side-by-side view of several experiments. finalMetrics is included because
     comparing inputs without the results they produced answers nothing — which
     run actually scored better is the question being asked. */
  async compare(experimentIds) {
    const experiments = await Promise.all(experimentIds.map((id) => this.getById(id)));
    return experiments.filter(Boolean).map((e) => ({
      id: e.id,
      name: e.name,
      params: e.params,
      hyperparams: e.hyperparams,
      status: e.status,
      finalMetrics: e.finalMetrics || {},
      modelId: e.modelId,
      datasetVersion: e.datasetVersion,
      createdAt: e.createdAt,
    }));
  },

  async complete(experimentId, { finalMetrics = {} } = {}) {
    const db = await openExperimentDb();
    const exp = await this.getById(experimentId);
    if (!exp) throw new Error(`Experiment ${experimentId} not found`);
    const updated = { ...exp, status: "completed", finalMetrics, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("experiments", "readwrite");
      tx.objectStore("experiments").put(updated);
      tx.oncomplete = () => resolve(updated);
      tx.onerror = () => reject(tx.error);
    });
  },

  async count() {
    const db = await openExperimentDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction("experiments", "readonly").objectStore("experiments").count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
};
