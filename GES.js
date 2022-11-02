//@ts-check
/// <reference path="./putTools.js" />

var /** @type {*}*/ d3 = eval("window['d3']");

/** @readonly @enum {number} */
const PHASE = {
  FORWARD: 1,
  BACKWARD: 2,
}

/**
 * @readonly @enum {number}
 * Used for labelling the arrows of a DAG as reversible or not.
 * An edge is reversible if it is undirected in the CPDAG. Compelled otherwise.
*/
const EDGE_LABELS = {
  COMPELLED: 1,
  REVERSIBLE: 2,
  UNKNOWN: 3,
}

class PDAG {
  /*
  Neighbor: --
  Adjacent: -- or -> or <-
  Parent: -- or ->
  Directed parent: ->

  Clique means under "adjacency" (see repo of Gamella, utils.py, is_clique, line 164)
  */

  n;
  mat;
  _NA_yx;

  /** @param {number[][]} adjMatrix */
  constructor(adjMatrix){
    const n = adjMatrix.length;
    this.n = n;
    this.mat = adjMatrix;
    this._NA_yx = {};
  }

  /**
   * @param {number} n
   */
  static newDisconnected(n){
    const mat = d3.range(n).map(i => d3.range(n).map(j=>0));
    return new PDAG(mat);
  }




  /**
   * @param {PHASE} phase
   * @returns {Generator<[number, number, number[]]>}
   */
  *iterNeighbors(phase) {
    const {n, mat} = this;
    if(phase == PHASE.FORWARD){
      for(let y = 0; y < n; y++){
        for(let x=0; x < n; x++) if(x!=y && !mat[x][y] && !mat[y][x]){
          for(let T of this.iterInsertT(y, x)){
            yield [y, x, T];
          }
        }
      }
    } else if(phase == PHASE.BACKWARD){
      for(let y = 0; y < n; y++){
        for(let x=0; x < n; x++) if(mat[x][y] || mat[y][x]){
          for(let H of this.iterDeleteH(y, x)){
            yield [y, x, H];
          }
        }
      }
    } else throw phase;
  }

  /** @param {number} x @param {number} y */
  NA_yx(y, x){
    const {n, mat} = this;
    const key = y*n+x;
    if(this._NA_yx[key]) return this._NA_yx[key];
    const N_y = d3.range(n).filter(x=>mat[x][y]&&mat[y][x]);
    const A_x = d3.range(n).filter(z=>mat[x][z]||mat[z][x]);
    return this._NA_yx[key] = d3.intersection(N_y, A_x);
  }
  /** @param {number} y */
  Pa(y){
    const {n, mat} = this;
    return d3.range(n).filter(x=>mat[x][y]&&!mat[y][x]);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Generator<number[]>}
   *
   * Neighboring states for delete operator.
   *
   * Assumptions:
   *   - either x--y or x->y in the CPDAG.
   * Output:
   *   Iteration of all sets H such that:
   *    1. H is composed of neighbors of y that are adjacent to x
   *    2. the set S = setMinus(this.NA_yx(y, x), H) is a clique
   */
  *iterDeleteH(y, x) {
    const {n, mat} = this;
    const NA_yx = [...this.NA_yx(y, x)];
    const S = new Set();
    const elems = [...NA_yx];
    function *iterH() {
      const t = elems.pop();
      if(t==undefined){
        const H = NA_yx.filter(x=>!S[x]);
        yield H;
        return;
      }
      yield* iterH();
      if(d3.every(S, z=>mat[z][t]||mat[t][z])){
        S.add(t);
        yield* iterH();
        S.delete(t);
      }
      elems.push(t);
    }
    yield* iterH();
  }


  /**
   * @param {number} x
   * @param {number} y
   * @returns {Generator<number[]>}
   *
   * Neighboring states for insert operator.
   *
   * Assumptions:
   *   - x and y are non-adjacent (neither of --,<-,->) in the CPDAG.
   * Output:
   *   Iteration of all sets T such that:
   *    1. T is a set composed of neighbors of y that are non-adjacent to x.
   *    2. the set S = setUnion(this.NA_yx(y,x), T) is a clique.
   *    3. Every semi-directed path (regex: --* -> (--|->)*) from y to x contains a node in S.
   *
   * The output is modified in place for speed.
   */
  *iterInsertT(y, x) {
    const {n, mat} = this;
    const test = this.blocksAllSemiDirected.bind(this);
    const NA_yx = this.NA_yx(y, x);
    const elems = d3.range(n).filter(z=>(mat[z][y]&&mat[y][z])&&(!mat[x][z]&&!mat[z][x]));
    const T = [];
    /** @param {boolean} testPassed whether the test(T) returned true*/
    function *iterT(testPassed) {
      const t = elems.pop();
      if(t==undefined){
        if(testPassed) yield T;
        return;
      }
      yield* iterT(testPassed);
      const S = d3.union(NA_yx, T);
      if(d3.every(S, z=>mat[z][t]||mat[t][z])){
        T.push(t);
        const blocks_t = testPassed||test(y, x, S); // optimization
        yield* iterT(blocks_t);
        T.pop();
      }
      elems.push(t);
    }
    const initialTestPassed = test(y, x, NA_yx);
    yield* iterT(initialTestPassed);
  }

  /** @param {number[]} nodes */
  isClique(nodes){
    const {mat} = this;
    return d3.every(nodes, x=>d3.every(nodes, y=>y==x||mat[x][y]||mat[y][x]));
  }

  /**
   * @param {number} y
   * @param {number} x
   * This method exists for testing purposes only.
   * Imitates this.iterInsertT but without the optimization that avoids calling
   * this.blocksAllSemiDirected unnecessarily. (first paragraph, p.p. 530)
   */
  *iterStatesInsert_explicit(y, x) {
    const {n, mat} = this;
    const N_y = d3.range(n).filter(x=>mat[x][y]&&mat[y][x]);
    const NA_yx = this.NA_yx(y, x);
    for(let DagPa of this.iterCliquesInsert(N_y, NA_yx)){
      if(this.blocksAllSemiDirected(y, x, DagPa)) yield DagPa;
    }
  }
  /**
   * @param {number[]} set
   * @param {number[]} fixed
   * Assumes fixed is a clique.
   * Iterates on all S = setUnion(fixed, T) where
   *  1. T is subset of set
   *  2. S is a clique
   */
  *iterCliquesInsert(set, fixed) {
    const {mat} = this;
    yield fixed;
    for(let t of set){
      if(d3.every(fixed, z=>mat[z][t]||mat[t][z])){ //?? definition of adj for clique
        const setMinus_t = set.filter(z=>z!=t);
        fixed.push(t);
        for(let out of this.iterCliquesInsert(setMinus_t, fixed)) yield out;
        fixed.pop();
      }
    }
  }

  /**
   * @param {number} src
   * @param {number} tgt
   * @param {any} wall
   * Checks wether all semi-directed paths src --..->..-- tgt contain one node in wall
   * A semi-directed path consists of at least one -> and zero, one or many --.
   */
  blocksAllSemiDirected(src, tgt, wall){
    const {mat, n} = this;
    let Q = [src];
    let vis = new Set(wall);
    vis.add(src);
    while(Q.length>0){
      let x = nonNull(Q.pop())
      for(let y = 0; y<n;y++) if(!vis.has(y) && mat[x][y]){
        Q.push(y);
        vis.add(y);
        if(y==tgt) return false;
      }
    }
    return true;
  }

  /** @param {number} x @param {number} y @param {number[]} T*/
  safetyCheckT(x, y, T){
    // Only for testing the implementation
    const {mat} = this;
    for(let t of T){
      let ok = !!mat[t][y]&&!!mat[y][t];
      if(!ok) throw 't is not neighbor of y';
      ok = !mat[x][t]&&!mat[t][x];
      if(!ok) throw 't is adjacent to x';
      let S = d3.union(this.NA_yx(y,x), T);
      ok = this.isClique([...S])
      if(!ok) throw 'S is not a clique';
    }
  }

  completionInPlace(){
    const {n, mat} = this;
    const DAG = this.DAG_Extension();
    if(!DAG) throw this;
    const CP = DAG.completion();
    for(let i=0;i<n;i++) for(let j=0;j<n;j++) mat[i][j] = CP.mat[i][j];
  }






  /*
  Dor 1992
  https://scholar.google.com/scholar?cluster=2669812910163446809
  G = copy of self
  A = copy of self
  while A has nodes:
      Select a vertex x which satisfies the following properties in the subgraph A:
        a. x is a sink, i.e. no edge x -> y exists in A
        b. the adjacent vertices of x form a clique
      
      Let all the edges which are incident to x in A be directed toward x in G
      A := A removing x (remove x and all the edges incident to x)
  return G' (an extension of the input pdag G)
  */
  DAG_Extension(){
    // DAG such that all directed arrows in this coincide with those in DAG
    const {n, mat} = this;
    const isClique = this.isClique.bind(this);
    // Initialize G and A
    const /**@type {number[][]}*/G = utils.zeros(n,n);
    const /**@type {number[][]}*/A = utils.zeros(n,n);
    let /**@type {number[]}*/nodesInA = d3.range(n);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++) G[i][j] = A[i][j] = mat[i][j];
    while(true){
      const x = (()=>{
        for(let i of nodesInA){
          if(d3.some(nodesInA, j=>A[i][j] && !A[j][i])) continue;
          const adj = nodesInA.filter(j=>A[i][j]||A[j][i]);
          if(isClique(adj)) return i;
        }
        return null;
      })();
      if(x==null) break;
      for(let i of nodesInA) if(A[i][x]){
        G[i][x] = 1;
        G[x][i] = 0;
      }
      nodesInA = nodesInA.filter(i=>i!=x);
    }
    return new DAG(G);
  }

  DAG_Extension2(){
    // DAG such that all directed arrows in this coincide with those in DAG. null if impossible
    const {n, mat} = this;
    // Initialize G and A
    const /**@type {number[][]}*/G = utils.zeros(n,n);
    const nodesMask = new Set(d3.range(n))
    // A is represented in multiple forms to improve speed and readability
    const A_Parents = d3.range(n).map(()=> new Set());
    const A_DirChildren = d3.range(n).map(()=> new Set());
    const A_Adjacent = d3.range(n).map(()=> new Set());
    const A_Neighbors = d3.range(n).map(()=> new Set());
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        G[i][j] = mat[i][j];
        if(mat[i][j]){
          A_Parents[j].add(i);
          A_Adjacent[j].add(i);
          A_Adjacent[i].add(j);
          if(!mat[j][i]) A_DirChildren[i].add(j)
          else A_Neighbors[i].add(j)
        }
      }
    }
    const condition = (x)=>(!A_DirChildren[x] &&
      d3.every(A_Neighbors[x], (y)=>d3.every(A_Adjacent[x], (z)=>A_Adjacent[z].has(y)))
    );
    while(nodesMask.size){
      // select the vertex x
      let x = null;
      for(let x_ of nodesMask){
        if(condition(x_)) {x=x_; break;}
      }
      if(x == null) return null; // No extension exists
      // update G
      for(let y of A_Adjacent[x]){
        G[y][x] = 1;
        G[x][y] = 0;
      }
      // remove x from A
      nodesMask.delete(x)
      for(let S of [A_Parents, A_Adjacent, A_DirChildren, A_Neighbors]){
        for(let v=0;v<n;v++) S[v].delete(x);
        S[x].clear();
      }
    }
    return new DAG(G);
  }

}


class DAG extends PDAG {

  /**
   * @returns {PDAG}
   * Assumes that this is a DAG
   * Copied from Gamella's implementation: dag_to_cpdag
   */
   completion(){
    const {n, mat} = this;
    const labels = this.labelEdges();
    const rev = labels.map(row=>row.map(v=>v==EDGE_LABELS.REVERSIBLE))
    const out = utils.zeros(n,n)
    for(let i = 0; i<n; i++) for(let j = 0; j<n; j++) if(mat[i][j]){
      out[i][j] = 1
      if(rev[i][j]) out[j][i] = 1;
    }
    return new PDAG(out);
  }

  toposortUpDown(){
    const {n, mat} = this;
    // Compute topological sort from ancestors to leaves
    const inDeg = utils.zeros(n);
    for(let b=0; b<n; b++) for(let a=0; a<n; a++) if(mat[b][a]) inDeg[a]++;
    const topoUpDown = [];
    const q = d3.range(n).filter(x=>inDeg[x]==0);
    while(true){
      let b = q.shift();
      if(b==undefined) break;
      topoUpDown.push(b);
      for(let a=0; a<n; a++){
        if(mat[b][a]){
          inDeg[a]--;
          if(inDeg[a]==0) q.push(a);
        }
      }
    }
    if(topoUpDown.length!=n) throw ["not a DAG", topoUpDown, mat]; // not a DAG
    return topoUpDown;
  }

  /**@returns {EDGE_LABELS[][]} */
  labelEdges(){
    // Algorithm Label-Edges(G) page 553
    const {n, mat} = this;
    const topoUpDown = this.toposortUpDown();
    const rev = [...topoUpDown].reverse();
    // Visit edges in the right order
    function* iterEdges(){
      for(let x of topoUpDown) for(let y of rev) if(mat[x][y]) yield [x,y];
    }

    const lab = utils.zeros(n, n);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){
      lab[i][j] = EDGE_LABELS.UNKNOWN;
    }
    for(let [x,y] of iterEdges()){
      if(lab[x][y] != EDGE_LABELS.UNKNOWN) continue;
      let flag = false;
      for(let w=0;w<n;w++) if(mat[w][x]&&lab[w][x]==EDGE_LABELS.COMPELLED){
        if(mat[w][y]) lab[w][y] = EDGE_LABELS.COMPELLED;
        else flag=true;
      }
      if(flag) for(let z=0;z<n;z++) if(mat[z][y]) lab[z][y] = EDGE_LABELS.COMPELLED;
      if(flag) continue;
      for(let z=0; z<n;z++) if(mat[z][y]&&z!=x&&!mat[z][x]){
        for(let z=0;z<n;z++) if(mat[z][y] && lab[z][y]==EDGE_LABELS.UNKNOWN){
          lab[z][y] = EDGE_LABELS.COMPELLED;
          flag = true;
        }
      }
      if(flag) continue;
      for(let z=0;z<n;z++) if(mat[z][y] && lab[z][y]==EDGE_LABELS.UNKNOWN){
        lab[z][y] = EDGE_LABELS.REVERSIBLE;
      }
    }
    return lab;
  }
}


var math = window["math"];
var mlMatrix = window["mlMatrix"];

class Model{

  _localScore;

  /**
   * @param {{[key:string]:any}[]} csvData
   * @param {string[]} columns
   * @param {{[key:string]:boolean}} isCategorical
   */
  constructor(csvData, columns, isCategorical){
    let data = csvData.map(d=>columns.map(key=>d[key]));
    const N = data.length;
    const n = this.n = columns.length;
    this.nCatOfCats = 0;
    this.nCat = 0;
    this.nCategories = utils.zeros(n);
    this.catEncodings = d3.range(n).map(()=>[]);
    for(let k in columns){
      if(isCategorical[columns[k]]){
        this.nCat++;
        const encoding = [...new Set(data.map(vec=>vec[k]))];
        const inv = Object.fromEntries(encoding.map((x,i)=>[x,i]));
        this.catEncodings[k] = encoding;
        this.nCategories[k] = encoding.length;
        this.nCatOfCats += encoding.length;
        for(let i=0;i<N;i++) data[i][k] = inv[data[i][k]];
      } else {
        for(let i=0;i<N;i++) data[i][k] = parseFloat(data[i][k]);
      }
    }
    this.dataWithNans = data;
    this.data = data.filter(l=>d3.every(l, x=>Number.isFinite(x)));
    this.N = data.length;
    this._localScore = {};
    this.columnNames = columns;
  }

  static fromCSV(csvData, columns, isCategorical){
    let data = csvData.map(d=>columns.map(key=>d[key]));
    return new Model(data, columns, isCategorical)
  }

  statefulGES(){
    const {n} = this;
    const localScore = this.localScore.bind(this);
    const P = PDAG.newDisconnected(n);
    let state = {
      score: d3.sum(d3.range(n).map(y=>this.localScore(y, []))),
      phase: PHASE.FORWARD,
      steps: 0,
      stepEnd: false,
      microSteps: 0,
      pause: false,
      algorithmEnd: false,
    };
    const current$ = new RX(0);
    const proposal$ = new RX(/**@type {{delta:number, update:any[]}|null}*/(null));
    const bestProposal$ = new RX(/**@type {{delta:number, update:any[]}|null}*/(null));

    function *iterGES(){
      for(let phase of [PHASE.FORWARD, PHASE.BACKWARD]){
        state.phase = phase;
        state.steps = 0;
        while(true){
          state.stepEnd = false;
          let nextUpdate = null;
          let nextDelta = 0;
          proposal$.set(null);
          bestProposal$.set(null);
          for(let update of P.iterNeighbors(phase)){
            // Compute score simulating update
            let delta=0;
            if(phase == PHASE.FORWARD){
              let [y, x, T] = update;
              const relatives = [...new Set(d3.union(d3.union(P.NA_yx(y, x), T), P.Pa(y)))];
              for(let z of relatives) if(x==z) throw z;
              const prevScore = localScore(y, relatives);
              relatives.push(x);
              delta = localScore(y, relatives) - prevScore;
            }
            else if(phase == PHASE.BACKWARD){
              let [y, x, H] = update;
              let relatives = [...d3.union(d3.difference(P.NA_yx(y, x), H), P.Pa(y))].filter(z=>z!=x);
              relatives.push(x);
              const prevScore = localScore(y, relatives);
              relatives.pop();
              delta = localScore(y, relatives) - prevScore;
            }
            if(delta > nextDelta){
              nextDelta = delta;
              nextUpdate = update;
              update[2] = [...update[2]]; // save H/T as a copy
              bestProposal$.set({delta, update});
            }
            state.microSteps++;
            proposal$.set({delta, update});
            yield null;
          }
          state.steps++;
          state.stepEnd = true;
          if(nextUpdate == null) break;
          // Apply update
          P._NA_yx = {}; // reset cache
          if(phase == PHASE.FORWARD){
            // Definition 12: rules for insert operator.
            let [y, x, T] = nextUpdate;
            P.mat[x][y] = 1;
            for(let t of T) P.mat[y][t] = 0;
          }
          else if(phase == PHASE.BACKWARD){
            let [y, x, H] = nextUpdate;
            P.mat[x][y] = P.mat[y][x] = 0;
            for(let h of H) P.mat[h][y] = 0;
            for(let h of H) P.mat[h][x] = 0;
          }
          else throw phase;
          P.completionInPlace(); // Transform to CPDAG
          state.score += nextDelta;
          current$.set(current$.value++);
          yield null;
        }
        current$.set(current$.value++);
        yield null;
      }
      state.algorithmEnd = true;
      current$.set(current$.value++);
    }
    const iter = iterGES.bind(this)();
    const microStep = ()=>{ iter.next();}
    const step = async ()=>{
      while(!iter.next().done) if(state.stepEnd || state.pause) return; else await sleep(0);
    }
    const allSteps = async ()=>{
      while(!iter.next().done) if(state.pause) return; else await sleep(0);
    }
    return {P, state, step, microStep, allSteps, current$, proposal$, bestProposal$};
  }


  /**
   * @param {number[]} columns  
   */
  MLE(columns){
    // TO DO.
  }

  /**
   * @param {number} y
   * @param {number[]} DagPa
   * DagPa is the list of parents of y in a DAG_Extension of this
   * (see the proof of Theorem 15)
   */
  localScore(y, DagPa){
    const {data:fullData, N, nCategories:fullNCategories} = this;
    const key = `${y} ${d3.sort(DagPa)}`;
    if(this._localScore[key]!==undefined) return this._localScore[key];

    const {data, nCat, nColumns, nCategories, yColumnIndex} = (()=>{
      // Filter relevant columns
      let columns = [y, ...DagPa];
      // Put categorical variables first
      columns = d3.sort(columns, k=>fullNCategories[k]==0?1:0);
      const yColumnIndex = columns.map((src, i)=>({src,i})).filter(({src})=>src==y)[0].i;
      const nCat = d3.sum(d3.map(columns, k=>fullNCategories[k]==0?0:1));
      // Re-index the data
      const data = utils.zeros(N, columns.length);

      for(let i = 0; i<N; i++) for(let j = 0; j<columns.length; j++){
        data[i][j] = fullData[i][columns[j]];
      }
      const nCategories = utils.zeros(nCat);
      for(let j = 0; j<columns.length; j++){
        nCategories[j] = fullNCategories[columns[j]];
      }
      return {data, nCat, nColumns:columns.length, nCategories, yColumnIndex};
    })();

    const nCatOfCat = d3.sum(nCategories);
    let nEmb = nCat<=1? nCat : nCatOfCat<=8? 2: nCatOfCat<=27? 3: nCatOfCat<=64? 4: 5;
    let n = nColumns - nCat + nEmb;

    // Initialize the model parameters
    let weights = d3.range(nCat).map(()=>1/nCat);
    let mu = utils.zeros(n);
    let sigma = utils.zeros(n, n);
    let centroids = d3.range(nCat).map(k=>d3.range(nCategories[k]).map(()=> d3.range(nEmb).map(()=>0)));

    let nIters = nCat==0?1:30;
    while(nIters-- > 0){
      // Estimate the embeddings using continuous data
      let sigma12 = new mlMatrix.Matrix(d3.range(0, nEmb).map(a=>d3.range(nEmb, n).map(b=>sigma[a][b])));
      let sigma22 = new mlMatrix.Matrix(d3.range(nEmb, n).map(a=>d3.range(nEmb, n).map(b=>sigma[a][b])));
      let auxMatrix = sigma12.mmul(mlMatrix.pseudoInverse(sigma22));

      let muEm = d3.range(N).map(i=>{
        const dataCont = mlMatrix.Matrix.columnVector(data[i].slice(nEmb, n));
        const muCont = mlMatrix.Matrix.columnVector(mu.slice(nEmb, n));
        return mlMatrix.Matrix.add(
          mlMatrix.Matrix.columnVector(mu.slice(0, nEmb)),
          auxMatrix.mmul(mlMatrix.Matrix.sub(dataCont, muCont)),
        ).data[0];
      });

      const softMax = (vec)=> {
        const pow = vec.map(x=>Math.exp(x));
        const sum = d3.sum(pow)
        return pow.map(x=>x/sum);
      }
      // Update the model connecting embedding with categorical data
      weights = (()=>{
        let z = d3.range(N).map(i=>d3.range(nCat).map(k=>{
          const out = utils.zeros(nEmb);
          for(let j=0;j<nEmb;j++) out[j] = muEm[i][j];
          for(let j=0;j<nEmb;j++) out[j] -= centroids[k][data[i][k]][j];
          for(let j=0;j<nEmb;j++) out[j] = -(out[j] * out[j]);
          return out;
        }));
        z = z.map(v=>softMax(v));
        z = d3.transpose(z);
        z = z.map(arr=>d3.mean(arr));
        return z;
      })();

      centroids = d3.range(nCat).map(k=>{
        const kCentroids = utils.zeros(nCategories[k], nEmb);
        for(let i=0; i<N; i++) for(let j=0; j<nEmb; j++) kCentroids[data[i][k]][j] += muEm[i][j];
        const sum = utils.zeros(nCategories[k], nEmb);
        for(let i=0; i<N; i++) for(let j=0; j<nEmb; j++) sum[data[i][k]][j]++;
        for(let A=0; A<nCategories[k]; A++) for(let j=0; j<nEmb; j++) kCentroids[A][j]/=sum[A][j];
        return kCentroids;
      });

      // Estimate the embeddings using discrete data
      muEm = d3.range(N).map(i=>()=>{
        const muEm = utils.zeros(nEmb);
        for(let k=0; k<nCat; k++) for(let j=0; j<nEmb; j++) muEm[j]+=weights[k]*centroids[k][data[i][k]];
        return muEm;
      });

      // Update the model connecting embedding with continuous data
      for(let j=0; j<n; j++) mu[j] = 0;
      for(let j=0; j<n; j++) for(let i=0; i<N; i++) mu[j] += data[i][j];
      for(let j=0; j<n; j++) mu[j] /= N;

      for(let a=0; a<n; a++) for(let b=0; b<n; b++) sigma[a][b] = 0;
      for(let a=0; a<n; a++) for(let b=a; b<n; b++) for(let i=0; i<N; i++){
        sigma[a][b] += (data[i][a]-mu[a])*(data[i][b]-mu[b]);
      }
      for(let a=0; a<n; a++) for(let b=a; b<n; b++) sigma[b][a] = (sigma[a][b] /= N);
    }

    const dataEmb = nCat==0? data : d3.range(N).map(i=>{
      let x = utils.zeros(n);
      for(let k=0; k<nCat; k++){
        for(let j=0; j<nEmb; j++) x[j] += weights[k] * centroids[k][data[i][j]];
      }
      for(let k=nCat; k<nColumns; k++) x[k] = data[i][k-nCat+nEmb];
      return x;
    });

    // // Compute the log-likelihood
    // const sigmaInv = mlMatrix.pseudoInverse(new mlMatrix.Matrix(sigma));
    // const muVec = mlMatrix.Matrix.columnVector(mu);
    // const logLikelihoods = dataEmb.map(x=>{
    //   x = mlMatrix.Matrix.columnVector(x);
    //   x = x.subtract(muVec);
    //   const out = x.transpose().mmul(sigmaInv).mmul(x)
    //   return -0.5*out.data[0][0];
    // });
    // // console.log(logLikelihoods.slice(100,110));
    // console.log(d3.mean(logLikelihoods));
    // console.log(mlMatrix.determinant(sigmaInv));


    // let logLikelihood = 0//-0.5*Math.log(2*Math.PI*N); // ?? missing rank and pseudo determinant
    // logLikelihood += d3.sum(logLikelihoods);
    // for(let x of DagPa) logLikelihood -= this.localScore(x, []);
    // /**
    //  * The main issue here is that if I compute the likelihood of the whole data,
    //  * I should compensate with the local scores at each of those nodes!
    //  */
    


    //Compute the log-likelihood
    // let condOnNonY = (valuesNonY)=>{
    //   let condMu = muY.add(auxSigma.mmul(mlMatrix.Matrix.sub(valuesNonY, muNonY)));
    //   return [condMu, condSigma];
    // }

    // let logLikelihood = 0;
    // for(let d of dataEmb){
    //   let valuesY = mlMatrix.Matrix.columnVector([y].map(x=>d[x]));
    //   const valuesNonY = nonY.map(x=>d[x]);
    //   const [condMuY, condSigmaY] = condOnNonY(valuesNonY);
    //   valuesY = valuesY.subtract(condMuY);
    //   const out = valuesY.transpose().mmul(condSigmaInv).mmul(valuesY)
    //   logLikelihood += out.data[0];
    // }


    
    // // Compute y_pred and use log of variance instead of log-likelihood
    const yIsContinuous = fullNCategories[y]==0;
    let logLikelihood = 0;

    let condSigma = (()=>{
      let sigmaM = new mlMatrix.Matrix(sigma);
      if(yIsContinuous && n==1) return sigmaM;

      const nonY = d3.range(n).filter(x=>x!=yColumnIndex);
      let sigma11 = new mlMatrix.Matrix([yColumnIndex].map(a=>[yColumnIndex].map(b=>sigma[a][b])));
      let sigma12 = new mlMatrix.Matrix([yColumnIndex].map(a=>nonY.map(b=>sigma[a][b])));
      let sigma21 = new mlMatrix.Matrix(nonY.map(a=>[yColumnIndex].map(b=>sigma[a][b])));
      let sigma22 = new mlMatrix.Matrix(nonY.map(a=>nonY.map(b=>sigma[a][b])));
  
      let auxSigma = sigma12.mmul(mlMatrix.pseudoInverse(sigma22));
      let condSigma = sigma11.subtract(auxSigma.mmul(sigma21));
      return condSigma;
      // let muY = new mlMatrix.columnVector([yColumnIndex].map(x=>mu[x]));
      // let muNonY = new mlMatrix.columnVector(nonY.map(x=>mu[x]));
      //let condSigmaInv = mlMatrix.pseudoInverse(condSigma);
    })();

    // if(yIsContinuous && n==1){
    //   const mse = d3.mean(data.map(d=>d[0]-mu[0]).map(x=>x*x));
    //   logLikelihood += - N * Math.log(mse); // I don't get why yet
    // }
    // else if(yIsContinuous) {
    //   // regression: remove y column
    //   const A = new mlMatrix.Matrix(dataEmb.map(record=>record.filter((d,i)=>i!=yColumnIndex)));
    //   const b = mlMatrix.Matrix.columnVector(dataEmb.map(record=>record[yColumnIndex]));
    //   const x = mlMatrix.solve(A, b, (mlMatrix.useSVD = true));
    //   let errors = mlMatrix.Matrix.sub(b, A.mmul(x)).data.map(arr=>arr[0]);
    //   let mse = d3.mean(errors.map(x=>x*x));
    //   console.log(mse);
    //   logLikelihood += - 0.5 * N * (1+Math.log(mse));
    // }
    // else throw 'NotImplemented';

    let det = mlMatrix.determinant(condSigma);
    let nEffective = n;
    if(det==0){
      const e = new mlMatrix.EigenvalueDecomposition(condSigma);
      const real = e.realEigenvalues;
      const nZeros = real.filter(x=>x==0).length;
      const pseudoDet = real.filter(x=>x!=0).reduce((a,b)=>a*b, 1);
      det = pseudoDet;
      nEffective -= nZeros;
      console.log("DET was zero. Dimensionality was reduced");
    }
    logLikelihood = N/2 * (-1 - Math.log(det));
    // logLikelihood = N/2 * (-1 - n*Math.log(2*Math.PI) - Math.log(det));
    
    // Number of parameters for the model that predicts y based on the others 
    // (this is not the number of parameters of the join distribution)

    const nParamsCon = nEffective-1;
    const nParamsCat = Math.max(0, nCat-1) /*weights*/ + nCatOfCat * nEmb /*centroids*/;
    const nParams = nParamsCon + nParamsCat;
    // const nParamsCon = n /*mu*/ + 0.5*nEffective*(nEffective+1) /*sigma*/;
    // const nParamsCat = Math.max(0, nCat-1) /*weights*/ + nCatOfCat * nEmb /*centroids*/;
    // const nParams = nParamsCon + nParamsCat;
    
    const score = logLikelihood - 0.5*Math.log(N) * nParams;
    //console.log(y, DagPa, score, logLikelihood);
    return this._localScore[key] = score;
  }

}





class Test_ContinuousDAG {
  n; edges_ijw; nodes_noise;

  constructor(n, edges_ijw, nodes_noise){
    this.n = n
    this.edges_ijw = edges_ijw
    this.nodes_noise = nodes_noise
  }

  children(){
    const {n} = this;
    const G = d3.range(n).map(()=>[]);
    for(let [i, j, _] of this.edges_ijw) G[i].push(j);
    return G;
  }

  parents(){
    const {n} = this;
    const R = d3.range(n).map(()=>[]);
    for(let [i, j, _] of this.edges_ijw) R[j].push(i);
    return R;
  }

  weights(){
    const {n} = this;
    const W = utils.zeros(n,n);
    for(let [i, j, w] of this.edges_ijw) W[i][j] = w;
    return W;
  }

  toposortUpDown(){
    const {n} = this;
    const Ch = this.children();
    const inDeg = utils.zeros(n);
    for(let i=0; i<n; i++) for(let j of Ch[i]) inDeg[j]++;
    const q = d3.range(n).filter(x=>inDeg[x]==0);
    const topo = [];
    while(true){
      const u = q.shift();
      if(u==undefined) break;
      topo.push(u);
      for(let v of Ch[u]){
        inDeg[v] -= 1
        if(inDeg[v] == 0) q.push(v);
      }
    }
    if(topo.length!=n) throw 'Cycle found';
    return topo;
  }

  static random_weights(n, edges_ij){
    const edges_ijw = edges_ij.map(([i,j])=>[i, j, randn()]);
    const nodesNoise = d3.range(n).map(x=> randn()**2);
    return new Test_ContinuousDAG(n, edges_ijw, nodesNoise);
  }

  sample_gaussian(size){
    const {n} = this;
    const Ch = this.children();
    const W = this.weights();
    const values = utils.zeros(size, n);
    for(let k=0; k<n;k++){
      const noise_std = this.nodes_noise[k];
      for(let i = 0; i < size; i++) values[i][k] += randn()*noise_std;
    }
    for(let b of this.toposortUpDown()){
      for(let a of Ch[b]){
        for(let i = 0; i < size; i++) values[i][a] += W[b][a] * values[i][b];
      }
    }
    return values;
  }

}

function randn() {
  let u = 1 - Math.random(); //Converting [0,1) to (0,1]
  let v = Math.random();
  return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}



