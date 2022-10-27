//@ts-check

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
  const running$ = new RX(false);
  const runButton = put('button $', 'Run');
  runButton.onclick = ()=>running$.set(true);
  const pauseButton = put('button $', 'Pause');
  pauseButton.onclick = ()=>running$.set(false);
  running$.subscribe((running)=>{
    put(runButton, running? '[disabled]':'[!disabled]');
    put(pauseButton, running? '[!disabled]':'[disabled]');
  });

  return [runButton, pauseButton];
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