//@ts-check
/// <reference path="./putTools.js" />

var /** @type {*}*/ d3 = eval("window['d3']");


class PDAG {
  /*
    Directed parent: ->
    Neighbor: --
    Parent: -- or ->
    Adjacent: -- or -> or <-
  */
  n;
  mat;
  /**
   * @param {number[][]} adjMatrix
   */
  constructor(adjMatrix){
    const n = adjMatrix.length;
    this.n = n;
    this.mat = adjMatrix;
  }

  /**
   * @param {number} n
   */
  static newDisconnected(n){
    const mat = d3.range(n).map(i => d3.range(n).map(j=>0));
    return new PDAG(mat);
  }

  /**
   * @param {1|2} phase
   */
  *iterNeighbors(phase) {
    const {n, mat} = this;
    if(phase == 1){
      for(let y = 0; y < n; y++){
        // const N_y = d3.range(n).filter(x=>mat[x][y]&&mat[y][x]);
        for(let x=0; x < n; x++) if(!mat[x][y] && !mat[y][x]){ // check this if(...)!
          for(let DagPaBefore of this.iterBlockingCliques(x, y)){
            const DagPaAfter = [...DagPaBefore, x];
            yield [y, DagPaAfter, DagPaBefore];  
          }
        }
      }
    }

  }
  /**
   * @param {number} x
   * @param {number} y
   */
  *iterBlockingCliques(x, y) {
    const {n, mat} = this;
    // Same as calling blocksAllSemiDirected(y,x,T) on each T yield by iterCliques(N_y, NA_yx)
    function *iterT(/**@type {number[]}*/ set, /**@type {number[]}*/ fixed, /**@type {boolean}*/ blocks) {
      yield [fixed, blocks];
      for(let t of set){
        if(d3.every(fixed, z=>mat[z][t]||mat[t][z])){ //?? definition of adj for clique
          const setMinus_t = set.filter(z=>z!=t);
          fixed.push(t);
          const blocks_t = blocks||this.blocksAllSemiDirected(y, x, fixed)
          for(let out of this.iter(setMinus_t, fixed, blocks_t)) yield out;
          fixed.pop();
        }
      }
    }
    const N_y = d3.range(n).filter(x=>mat[x][y]&&mat[y][x]);
    const A_x = d3.range(n).filter(z=>mat[x][z]||mat[z][x]);
    const NA_yx = d3.intersection(N_y, A_x);
    const initialBlocks = this.blocksAllSemiDirected(y, x, NA_yx);
    for(let [DagPa, blocks] of iterT(N_y, NA_yx, initialBlocks)) if(blocks) yield DagPa;
  }
  /**
   * @param {number} x
   * @param {number} y
   */
  *iterBlockingCliques_2(x, y) { // Without blocks optimization
    const {n, mat} = this;
    const N_y = d3.range(n).filter(x=>mat[x][y]&&mat[y][x]);
    const A_x = d3.range(n).filter(z=>mat[x][z]||mat[z][x]);
    const NA_yx = d3.intersection(N_y, A_x);
    for(let DagPa of this.iterCliques(N_y, NA_yx)){
      if(this.blocksAllSemiDirected(y, x, DagPa)) yield DagPa;
    }
  }

  /**
   * @param {number[]} set
   * @param {number[]} fixed
   */
  *iterCliques(set, fixed) {
    const {mat} = this;
    // Iterates on S = d3.union(T, fixed) where T is subset of set and S is a clique
    // Assumes fixed is a clique.
    yield fixed;
    for(let t of set){
      if(d3.every(fixed, z=>mat[z][t]||mat[t][z])){ //?? definition of adj for clique
        const setMinus_t = set.filter(z=>z!=t);
        fixed.push(t);
        for(let out of this.iterCliques(setMinus_t, fixed)) yield out;
        fixed.pop();
      }
    }
  }

  /**
   * @param {number} src
   * @param {number} tgt
   * @param {any} wall
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

  isComplete(){
    // if and only if this does not contain any partially undirected cycle,
    // i.e. at least one -> and as many -- as you want.

  }
  complete(){
    
  }

  extendWith(){
    
  }


  /*
  Dor 1992
  https://scholar.google.com/scholar?cluster=2669812910163446809
  G = copy of self
  A = copy of self
  while A has nodes:
      Select a vertex x which satisfies the following properties in the subgraph A:
        a. x is a sink (no edge ( x , y ) in A is directed outward from x)
        b. For every vertex y , adjacent to x, with ( x ^ y ) undirected, y is adjacent to all the other vertices which are adjacent to x;

      Let all the edges which are incident to x in A be directed toward x in G

      A := A — x (remove x and all the edges incident to x)
  return G' (an extension of the input pdag G)
  */
  DAG_Extension(){
    // DAG such that all directed arrows in this coincide with those in DAG. null if impossible
    const {n, mat} = this;
    // Initialize G and A
    const /**@type {number[][]}*/G = d3.range(n).map(()=>d3.range(n).map(()=>0));
    const nodesMask = new Set(d3.range(n))
    // A is represented in multiple forms to improve speed and readability
    const A_Parents = d3.range(n).map(()=> new Set());
    const A_DirChildren = d3.range(n).map(()=> new Set());
    const A_Adjacent = d3.range(n).map(()=> new Set());
    const A_Neighbors = d3.range(n).map(()=> new Set());
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        G[i][j] = 1;
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
    return new PDAG(G);
  }

}



var math = window["math"];
var mlMatrix = window["mlMatrix"];

class Model{

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
  }

  statefulGES(){
    const {n} = this;
    const P = PDAG.newDisconnected(n);
    let state = {
      score: 0,
      phase: /**@type {1|2}*/(1),
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
      for(let phase of /**@type {(1|2)[]}*/([1,2])){
        state.phase = phase;
        state.steps = 0;
        while(true){
          state.stepEnd = false;
          let nextUpdate = null;
          let nextDelta = -(1<<49);
          for(let update of P.iterNeighbors(phase)){
            let [y, DagPaAfter, DagPaBefore] = update;
            const delta = this.localScore(y, DagPaAfter) - this.localScore(y, DagPaBefore);
            if(delta > nextDelta){
              nextDelta = delta;
              nextUpdate = update;
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
          let [y, DagPaAfter, _] = nextUpdate;
          for(let x of DagPaAfter){
            P.mat[x][y] = 1;
            P.mat[y][x] = 0;
          }
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
    const step = ()=>{ while(!iter.next().done) if(state.stepEnd || state.pause) return; }
    const allSteps = ()=>{ while(!iter.next().done) if(state.pause) return; }
    return {P, state, step, microStep, allSteps, current$, proposal$, bestProposal$};
  }

  /**
   * @param {number} y
   * @param {number[]} DagPa
   * DagPa is the list of parents of y in a DAG_Extension of this
   * (see the proof of Theorem 15)
   */
  localScore(y, DagPa){
    const {data:fullData, N, nCategories:fullNCategories} = this;

    const {data, nCat, nColumns, nCategories} = (()=>{
      // Filter relevant columns
      let columns = [y, ...DagPa];
      // Put categorical variables first
      columns = d3.sort(columns, k=>fullNCategories[k]==0?1:0);
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
      return {data, nCat, nColumns:columns.length, nCategories};
    })();

    const nCatOfCat = d3.sum(nCategories);
    let nEmb = nCat<=1? nCat : nCatOfCat<=8? 2: nCatOfCat<=27? 3: nCatOfCat<=64? 4: 5;
    let n = nColumns - nCat + nEmb;
    
    // Initialize the model parameters
    let weights = d3.range(nCat).map(()=>1/nCat);
    let mu = utils.zeros(n);
    let sigma = utils.zeros(n, n);
    let centroids = d3.range(nCat).map(k=>d3.range(nCategories[k]).map(()=> d3.range(nEmb).map(()=>0)));

    let nIters = 30;
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

    // Compute the log-likelihood
    const x_minus_mu = new mlMatrix.Matrix(d3.range(N).map(i=>{
      let x = utils.zeros(n);
      for(let k=0; k<nCat; k++){
        for(let j=0; j<nEmb; j++) x[j] += weights[k] * centroids[k][data[i][j]]; 
      }
      for(let j=nCat; j<n; j++) x[j] = data[i][j+nCat];
      for(let j=0; j<n; j++) x[j] -= mu[j];
      return x;
    }));
    let logLikelihood = -0.5*math.log(2*math.pi*N); // unnecessary constant, but clear 
    logLikelihood += -0.5*x_minus_mu.mmul(new mlMatrix.Matrix(sigma)).mmul(x_minus_mu.transpose());
    let nParams = n/*mu*/ + n*n /*sigma*/ + /*weights*/ nCat + /*centroids*/ nCatOfCat * nEmb;
    return logLikelihood - 0.5*nParams*math.log(N);
  }

}


`

class DAG(PDAG):

    def reversed_graph(self):
        R = [[] for _ in range(self.n)]
        for i in range(self.n):
            for j in range(self.n):
                if self.mat[i, j]:
                    R[j].append(i)
        return R

    def toposort(self):
        R = self.reversed_graph()
        return [len(l) for l in R]

    def equivalence_class(self):
        n = self.n
        mat = np.zeros((n, n), dtype=bool)
        # ordered = self.toposort()

        # # 2. Label edges as compelled or reversible
        # labelled = label_edges(ordered)
        # # 3. Construct CPDAG
        # cpdag = np.zeros_like(labelled)
        # # set compelled edges
        # cpdag[labelled == 1] = labelled[labelled == 1]
        # # set reversible edges
        # fros, tos = np.where(labelled == -1)
        # for (x, y) in zip(fros, tos):
        #     cpdag[x, y], cpdag[y, x] = 1, 1
        # return cpdag
        return CPDAG.from_matrix(mat)

    def label_edges(self, ordered):
        # # Validate the input
        # if not is_dag(ordered):
        #     raise ValueError("The given graph is not a DAG")
        # no_edges = (ordered != 0).sum()
        # if sorted(ordered[ordered != 0]) != list(range(1, no_edges + 1)):
        #     raise ValueError("The ordering of edges is not valid:", ordered[ordered != 0])
        # # define labels: 1: compelled, -1: reversible, -2: unknown
        # COM, REV, UNK = 1, -1, -2
        # labelled = (ordered != 0).astype(int) * UNK
        # # while there are unknown edges
        # while (labelled == UNK).any():
        #     # print(labelled)
        #     # let (x,y) be the unknown edge with lowest order
        #     # (i.e. appears last in the ordering, NOT has smalles label)
        #     # in ordered
        #     unknown_edges = (ordered * (labelled == UNK).astype(int)).astype(float)
        #     unknown_edges[unknown_edges == 0] = -np.inf
        #     # print(unknown_edges)
        #     (x, y) = np.unravel_index(np.argmax(unknown_edges), unknown_edges.shape)
        #     # print(x,y)
        #     # iterate over all edges w -> x which are compelled
        #     Ws = np.where(labelled[:, x] == COM)[0]
        #     end = False
        #     for w in Ws:
        #         # if w is not a parent of y, label all edges into y as
        #         # compelled, and finish this pass
        #         if labelled[w, y] == 0:
        #             labelled[list(pa(y, labelled)), y] = COM
        #             end = True
        #             break
        #         # otherwise, label w -> y as compelled
        #         else:
        #             labelled[w, y] = COM
        #     if not end:
        #         # if there exists an edge z -> y such that z != x and z is
        #         # not a parent of x, label all unknown edges (this
        #         # includes x -> y) into y with compelled; label with
        #         # reversible otherwise.
        #         z_exists = len(pa(y, labelled) - {x} - pa(x, labelled)) > 0
        #         unknown = np.where(labelled[:, y] == UNK)[0]
        #         assert x in unknown
        #         labelled[unknown, y] = COM if z_exists else REV
        # return labelled
        return


class CPDAG(PDAG):

    def iter_forward_neighbors(self):
        change = 7, []
        yield self, change
        return

    def iter_backward_neighbors(self):
        change = 7, []
        yield self, change
        return

    @classmethod
    def new_disconnected(cls, n: int):
        return cls()


`