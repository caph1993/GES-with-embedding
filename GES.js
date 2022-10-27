//@ts-check



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

  forwardNeighbors(){
    
  }

  backwardNeighbors(){
    
  }

  isComplete(){
    // if and only if this does not contain any partially undirected cycle,
    // i.e. at least one -> and as many -- as you want.

  }
  complete(){
    
  }
  extendWith(){
    
  }

  extension(){
    // DAG such that all directed arrows in this coincide with those in DAG 
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

    // Initialize G and A
    // A is represented in multiple forms to improve speed and readability
    const {n, mat} = this;
    const /**@type {number[][]}*/G = d3.range(n).map(()=>d3.range(n).map(()=>0));
    const nodesMask = new Set(d3.range(n))
    const AParents = d3.range(n).map(()=> new Set());
    const ADirChildren = d3.range(n).map(()=> new Set());
    const AAdjacent = d3.range(n).map(()=> new Set());
    const ANeighbors = d3.range(n).map(()=> new Set());
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){
        G[i][j] = 1;
        if(mat[i][j]){
          AParents[j].add(i);
          AAdjacent[j].add(i);
          AAdjacent[i].add(j);
          if(!mat[j][i]) ADirChildren[i].add(j)
          else ANeighbors[i].add(j)
        }
      }
    }
    const condition = (x)=>(!ADirChildren[x] &&
      d3.every(ANeighbors[x], (y)=>d3.every(AAdjacent[x], (z)=>AAdjacent[z].has(y)))
    );
    while(nodesMask.size){
      // select the vertex x
      let x = null;
      for(let x_ of nodesMask){
        if(condition(x_)) {x=x_; break;}
      }
      if(x == null){
        return; // No extension exists
      }
      // update G
      for(let y of AAdjacent[x]){
        G[y][x] = 1;
        G[x][y] = 0;
      }
      // remove x from A
      nodesMask.delete(x)
      for(let S of [AParents, AAdjacent, ADirChildren, ANeighbors]){
        for(let v=0;v<n;v++) S[v].delete(x);
        S[x].clear();
      }
    }

    return DAG.from_matrix(G)
  }

  score() {

  }
}

const GES = (data, isCategorical, dStar)=>{
  
  return ;
}



`
class PDAG:
    mat: np.ndarray
    n: int

    @classmethod
    def from_matrix(cls, mat: np.ndarray):
        pdag = cls.__new__(cls)
        pdag.mat = mat
        pdag.n = len(mat)
        mat.flags.writeable = False  # Own the matrix
        assert mat.shape == (pdag.n, pdag.n)

    def copy(self):
        cls = self.__class__
        cpy = cls.__new__(cls)
        return cpy


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


class Model:

    def __init__(self, data, data_types):
        self.data = data
        self.data_types = data_types
        return

    def GES(self):
        P = CPDAG.new_disconnected(len(self.data))
        score = 0
        # Forward phase:
        while True:
            Q, delta = self.best_forward_neighbor(P)
            if delta <= 0:
                break
            P, score = Q, score + delta
        # Backward phase:
        while True:
            Q, delta = self.best_backward_neighbor(P)
            if delta <= 0:
                break
            P, score = Q, score + delta
        return P, score

    def best_forward_neighbor(self, P: CPDAG):
        it = self.iter_scored_forward_neighbors(P)
        return max(it, key=lambda t: t[1])

    def iter_scored_forward_neighbors(self, P: CPDAG):
        for Q, change in P.iter_forward_neighbors():
            delta = 0.0
            yield Q, delta
        return

    def best_backward_neighbor(self, P: CPDAG):
        it = self.iter_scored_backward_neighbors(P)
        return max(it, key=lambda t: t[1])

    def iter_scored_backward_neighbors(self, P: CPDAG):
        for Q, change in P.iter_backward_neighbors():
            i, Pa = change
            delta = self.local_score(i, Pa) - self.local_score(i, Pa)

            yield Q, delta
        return

    def local_score(self, i: int, Pa: Collection[int]):
        return 0.0
`