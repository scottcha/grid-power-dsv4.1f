/**
 * Minimal max-flow solver used for power dispatch.
 *
 * Generators and storage are supply nodes, loads are demand nodes, and
 * adjacent structures are connected by undirected links with a capacity.
 * Dinic's algorithm is plenty: a player's network has at most a few hundred
 * edges and is solved a handful of times per turn (plus once for UI preview).
 */

export interface FlowEdgeInput {
  a: number;
  b: number;
  cap: number;
}

export interface FlowResult {
  total: number;
  /** Power actually injected by each supply node. */
  produced: number[];
  /** Demand actually met at each load node. */
  served: number[];
  /** Signed net flow per edge: positive = a → b. */
  edgeFlow: number[];
  congested: boolean[];
}

interface Arc {
  to: number;
  cap: number;
  reverse: number;
}

const EPS = 1e-7;

export function maxFlow(
  nodeCount: number,
  supply: readonly number[],
  demand: readonly number[],
  edges: readonly FlowEdgeInput[],
): FlowResult {
  const source = nodeCount;
  const sink = nodeCount + 1;
  const graph: Arc[][] = Array.from({ length: nodeCount + 2 }, () => []);

  const addArc = (from: number, to: number, cap: number): number => {
    const forward: Arc = { to, cap, reverse: graph[to].length };
    const backward: Arc = { to: from, cap: 0, reverse: graph[from].length };
    graph[from].push(forward);
    graph[to].push(backward);
    return graph[from].length - 1;
  };

  const supplyArcs: number[] = [];
  const demandArcs: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    supplyArcs.push(supply[i] > 0 ? addArc(source, i, supply[i]) : -1);
    demandArcs.push(demand[i] > 0 ? addArc(i, sink, demand[i]) : -1);
  }

  const edgeForwardIdx: number[] = [];
  const edgeFrom: number[] = [];
  for (const edge of edges) {
    const fIdx = graph[edge.a].length;
    const bIdx = graph[edge.b].length;
    graph[edge.a].push({ to: edge.b, cap: edge.cap, reverse: bIdx });
    graph[edge.b].push({ to: edge.a, cap: edge.cap, reverse: fIdx });
    edgeForwardIdx.push(fIdx);
    edgeFrom.push(edge.a);
  }

  const level = new Int32Array(nodeCount + 2);
  const iter = new Int32Array(nodeCount + 2);

  const bfs = (): boolean => {
    level.fill(-1);
    level[source] = 0;
    const queue = [source];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      for (const arc of graph[v]) {
        if (arc.cap > EPS && level[arc.to] < 0) {
          level[arc.to] = level[v] + 1;
          queue.push(arc.to);
        }
      }
    }
    return level[sink] >= 0;
  };

  const dfs = (v: number, pushed: number): number => {
    if (pushed <= EPS || v === sink) return pushed <= EPS ? 0 : pushed;
    for (; iter[v] < graph[v].length; iter[v]++) {
      const arc = graph[v][iter[v]];
      if (arc.cap <= EPS || level[arc.to] !== level[v] + 1) continue;
      const flow = dfs(arc.to, Math.min(pushed, arc.cap));
      if (flow > EPS) {
        arc.cap -= flow;
        graph[arc.to][arc.reverse].cap += flow;
        return flow;
      }
    }
    level[v] = -1;
    return 0;
  };

  let total = 0;
  while (bfs()) {
    iter.fill(0);
    for (;;) {
      const pushed = dfs(source, Number.POSITIVE_INFINITY);
      if (pushed <= EPS) break;
      total += pushed;
    }
  }

  const produced = supply.map((s, i) => {
    if (s <= 0) return 0;
    return Math.max(0, s - graph[source][supplyArcs[i]].cap);
  });
  const served = demand.map((d, i) => {
    if (d <= 0) return 0;
    return Math.max(0, d - graph[i][demandArcs[i]].cap);
  });

  const edgeFlow: number[] = [];
  const congested: boolean[] = [];
  for (let i = 0; i < edges.length; i++) {
    const residual = graph[edgeFrom[i]][edgeForwardIdx[i]].cap;
    const net = edges[i].cap - residual;
    edgeFlow.push(Math.abs(net) < EPS ? 0 : net);
    congested.push(Math.abs(net) >= edges[i].cap - 1e-5);
  }

  return { total, produced, served, edgeFlow, congested };
}
