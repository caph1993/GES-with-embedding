//@ts-check
/// <reference path="./putTools.js" />
/// <reference path="./GES.js" />

const fileInput = (csv$)=>{
  const file$ = new RX(/** @type {*} */(null));
  const input = put('input[type="file"][accept="text/csv"]');
  const button = put('button[disabled] $', 'Submit');
  const root = put('div', [input, button])
  input.onchange = (e)=>{
    const file = /**@type {*}*/(e.target).files[0];
    file$.set(file);
    put(button, file?'[!disabled]':'[disabled]');
  }
  button.onclick = async () => {
    const d3 = await putLoader.require('d3', './libraries/d3.v7.min.js')
    const csv = d3.csvParse(await file$.value.text());
    csv$.set(csv);
    root.replaceWith(
      ...putNodes`
      Loaded ${file$.value.name}

      Reload the page to change the dataset
      `,
    );
  }
  return root;
}

const variableTypeSelector = (csv, isCategorical$)=>{
  console.log(csv)
  const isCategorical$_ = new RX({});
  const root = put('div', [
    putText('Check categorical variables:'),
    put('ul', csv.columns.map(colName=>{
      const input = put('input[type="checkbox"]');
      const bool$ = new RX(false, `var-is-discrete-${colName}`);
      bool$.subscribe(bool=>put(input, bool?'[checked]':'[!checked]'));
      input.onchange = ()=>bool$.set(!bool$.value);
      bool$.subscribe(bool=>{
        isCategorical$_.value[colName] = bool;
        isCategorical$_.set(Object.assign({}, isCategorical$_.value));
      });
      return put('div', [input, putText(colName)]);
    }).map(x=>put('li', x))),
    put('div', [
      putText(`Number of variables: ${csv.columns.length}`),
      put('ul', [
        putNodes`Continuous: ${isCategorical$_.map(d=>csv.columns.length - Object.keys(d).filter((k)=>d[k]).length)}`,
        putNodes`Discrete: ${isCategorical$_.map(d=>Object.keys(d).filter((k)=>d[k]).length)}`,
        putNodes`Discrete embedding: ${isCategorical$_.map(d=>Object.keys(d).filter((k)=>d[k]).length)}`,
      ].map(x=>put('li', x))),
    ]),
    (()=>{
      const button = put('button $', 'Done');
      button.onclick = ()=> isCategorical$.set(isCategorical$_.value);
      return button;
    })(),
  ])
  return root;
}

const runControls = (csv, isCategorical)=>{


  const model = new Model(csv, csv.columns, isCategorical);
  const {P, state, step, allSteps, microStep, current$, proposal$, bestProposal$} = model.statefulGES();
  const running$ = new RX(false);
  console.log(csv.columns)
  const graphLabels = (()=>{
    const shorts = csv.columns.map(s=>s.substring(0,3));
    return shorts;
  })()

  const runStep = put('button $', '--step-->');
  runStep.onclick = ()=>{
    state.pause = false;
    running$.set(true);
    step();
    running$.set(false);
  }
  const runMicroStep = put('button $', '--microStep-->');
  runMicroStep.onclick = ()=>{
    state.pause = false;
    running$.set(true);
    microStep();
    running$.set(false);
  }
  const runAllSteps = put('button $', 'Run (all steps)');
  runAllSteps.onclick = ()=>{
    state.pause = false;
    running$.set(true);
    allSteps();
    running$.set(false);
  }
  
  const pause = put('button $', 'Pause');
  pause.onclick = ()=>{
    state.pause = true;
    running$.set(false);
  }
  running$.subscribe((running)=>{
    put(runStep, running? '[disabled]':'[!disabled]');
    put(runMicroStep, running? '[disabled]':'[!disabled]');
    put(runAllSteps, running? '[disabled]':'[disabled]');
    put(pause, running? '[!disabled]':'[disabled]');
  });

  const score = putText(current$.map(()=>state.score));
  const vizLoading = `graph G{\nbgcolor=lightgray\ncolor=black\n a [label="Loading"]; }`;
  const vizTooLarge = (n)=>`graph G{\nbgcolor=lightgray\ncolor=black\n a [label="Too large to be displayed: ${n} nodes"]; }`;
  return [
    runStep,
    runMicroStep,
    runAllSteps,
    pause,
    ...putNodes`<div>Score: ${score}</div>`,
    ...putNodes`<div>Proposal: ${proposal$.map(p=>p&&p.delta)}</div>`,
    ...putNodes`<div>Best proposal: ${bestProposal$.map(p=>p&&p.delta)}</div>`,
    ...DotGraphViz(current$.map(()=>{
      if(P.n >= 60) return vizTooLarge(P.n);
      let arrows = [];
      for(let a=0;a<P.n;a++) for(let b=a+1;b<P.n;b++) if(P.mat[a][b]||P.mat[b][a]){
        if(!P.mat[a][b]) arrows.push(`${b} -> ${a};`); 
        else if(!P.mat[b][a]) arrows.push(`${a} -> ${b};`); 
        else arrows.push(`${b} -- ${a};`); 
      }
      const sNodes = d3.range(P.n).map(i=>`${i} [label="${graphLabels[i]}"];`).join('\n');
      const sArrows = arrows.join('\n');
      const dot = `
      digraph G{
        bgcolor="#eeeeee"
        node [fontcolor="#000000"];
        edge [color="#000000"];
        ${sNodes}
        ${sArrows}
      }`
      return dot;
    })),
  ];
}


(()=>{
  // const csv$ = new RX(null);
  //@ts-ignore
  const csvTest = JSON.parse(localStorage.getItem('csv-test')); csvTest.columns = JSON.parse(localStorage.getItem('csv-columns'));
  const csv$ = new RX(csvTest);
  const isCategorical$ = new RX(null);
  const varSelector = put('div');
  const controls = put('div');
  const exported = mainBody(
    put('h1', "Load dataset"),
    fileInput(csv$),
    put('h1', "Set variable types"),
    varSelector,
    put('h1', "GES"),
    controls,
  );
  csv$.subscribe(csv=>{
    if(csv==null) return;
    varSelector.replaceWith(variableTypeSelector(csv, isCategorical$));
  })
  isCategorical$.subscribe((isCategorical)=>{
    if(isCategorical==null) return;
    controls.replaceWith(...runControls(csv$.value, isCategorical));
  })
  putLoader.exportDefault(exported);
})()