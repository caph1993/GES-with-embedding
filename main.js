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

const variableTypeSelector = (csv, isCategorical$, loadedDataset$)=>{
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
      button.onclick = ()=>{
        isCategorical$.set(isCategorical$_.value);
        loadedDataset$.trigger();
      }
      button.onclick(/**@type {*} */(null)); // AUTO-CLICK
      return button;
    })(),
  ])
  return root;
}






(()=>{
  const csv$ = new RX(/**@type {*}*/(null));
  const isCategorical$ = new RX(/**@type {*}*/(null));
  const model$ = new RX(/**@type {Model} */(/**@type {*}*/(null)));
  const loadedDataset$ = RX.trigger();

  loadedDataset$.silentSubscribe(()=>{
    const csv = csv$.value;
    model$.set(new Model(csv, csv.columns, isCategorical$.value));
  });

  const varSelector = put('div');

  csv$.subscribe(csv=>{
    if(csv==null) return;
    varSelector.replaceWith(variableTypeSelector(csv, isCategorical$));
  });

  const tabsData = put(put('div'), [
    put('h1', "Load dataset"),
    ...Tabs({ entries: [['upload', 'Dataset upload'], ['test', 'Synthetic test'], ['example', 'Example']],
      localStorageKey: 'tab-dataset-upload',
      defaultKey: 'test',
    },
      put(put('div[tab=$]', 'upload'), (()=>{
        return [
          fileInput(csv$),
          put('h1', "Set variable types"),
          varSelector,
        ];
      })()),
      put(put('div[tab=$]', 'example'), (()=>{
        const buttonAdult = put('button[disabled] $', 'Load test-adult-100... NOT READY');
        buttonAdult.onclick = ()=>{
          //@ts-ignore
          const csvTest = JSON.parse(localStorage.getItem('csv-test')); csvTest.columns = JSON.parse(localStorage.getItem('csv-columns'));
          csv$.set(csvTest);
        }
        return buttonAdult;
      })()),
      put(put('div[tab=$]', 'test'), (()=>{
        const dot$ = new RX('');
        const viz = DotGraphViz(dot$);
        const presetsSkeleton = {
          vStructure: [3, [[0,1], [2, 1]]],
          confounder: [3, [[1,0], [1, 2]]],
          chain: [3, [[0,1], [1, 2]]],
          pairAndOne: [3, [[2,1]]],
          three: [3, []],
          two: [2, []],
          pair: [2, [[0,1]]],
          one: [1, []],
          six1: [6, [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5]]],
        };

        /**@type {Test_ContinuousDAG} */
        let G;
        let columns;

        const ulNoise = put('ul');
        const presetButtons = Object.entries(presetsSkeleton).map(([key, [n, edges]])=>{
          const button = put('button $', key);
          button.onclick = ()=>{
            G = Test_ContinuousDAG.random_weights(n, edges);
            columns = d3.range(G.n).map(i=>`X${i+1}`);
            dot$.set(weightedDagToDot(G));
            put(doneButton, '[!disabled]');
            ulNoise.replaceChildren(...[
              ...d3.range(G.n).map(i=>
                putNodes`Noise injected to ${columns[i]}: std=${G.nodes_noise[i].toFixed(1)}`
              )
            ].map(e=>put('li', e)));
          }
          return button;
        });
        //@ts-ignore
        //(async()=>presetButtons[0].onclick(/**@type {*} */(null)))(); // AUTO-CLICK
        
        const doneButton = put('button[disabled] $', 'Generate');
        const nSamples$ = new RX(250);

        doneButton.onclick = ()=>{
          let data = G.sample_gaussian(nSamples$.value);
          data = data.map(d=>Object.fromEntries(d3.zip(columns, d)));
          model$.set(new Model(data, columns, {}));
        }
        return [
          ...presetButtons,
          put('br'),
          viz,
          ulNoise,
          put('div', [
            put('span $', 'Number of samples: '),
            ...numberInputWithButtons(nSamples$),
          ]),
          doneButton,
        ];
      })()),
    ),
  ]);
  
  const GesElem = put('div');

  let mkGraphLabels = (model)=>{
    const shorts = model.columnNames.map(s=>s.substring(0,3));
    return shorts;
  };

  model$.subscribeOnce((model)=>{
    let ges = model.statefulGES();
    let graphLabels = mkGraphLabels(model);

    model$.silentSubscribe((model)=>{
      // Permanent subscription
      const old = ges;
      ges = model.statefulGES();
      graphLabels = mkGraphLabels(model);
      old.current$.set(ges.current$.value);
      old.current$.remapMappings(ges.current$);
      old.proposal$.remapMappings(ges.proposal$);
      old.bestProposal$.remapMappings(ges.bestProposal$);
      running$.notify();
    });

    const running$ = new RX(false);

    const runStep = put('button $', '--step-->');
    runStep.onclick = ()=>{
      ges.state.pause = false;
      running$.set(true);
      (async ()=>{
        await sleep(1);
        await ges.step();
        running$.set(false);
      })()
    }
    const runMicroStep = put('button $', '--microStep-->');
    runMicroStep.onclick = ()=>{
      ges.state.pause = false;
      running$.set(true);
      (async ()=>{
        await sleep(1);
        await ges.microStep();
        running$.set(false);
      })()
    }
    const runAllSteps = put('button $', 'Run (all steps)');
    runAllSteps.onclick = ()=>{
      ges.state.pause = false;
      running$.set(true);
      (async ()=>{
        await sleep(1);
        await ges.allSteps();
        running$.set(false);
      })()
    }

    const pause = put('button $', 'Pause');
    pause.onclick = ()=>{
      ges.state.pause = true;
      running$.set(false);
    }
    running$.subscribe((running)=>{
      const canRun = !ges.state.algorithmEnd && !running;
      put(runStep, canRun? '[!disabled]':'[disabled]');
      put(runMicroStep, canRun? '[!disabled]':'[disabled]');
      put(runAllSteps, canRun? '[!disabled]':'[disabled]');
      put(pause, running? '[!disabled]':'[disabled]');
    });

    const score = putText(ges.current$.map(()=>ges.state.score));

    GesElem.replaceChildren(...[
      put('h1', "GES"),
      runStep,
      runMicroStep,
      runAllSteps,
      pause,
      ...putNodes`<div>Score: ${score}</div>`,
      ...putNodes`<div>Proposal: ${ges.proposal$.map(p=>p&&p.delta)}</div>`,
      ...putNodes`<div>Best proposal: ${ges.bestProposal$.map(p=>p&&p.delta)}</div>`,
      ...putNodes`<div>Data: ${model$.map(model=>model.N)} samples, ${model$.map(model=>model.columnNames.length)} columns</div>`,
      DotGraphViz(ges.current$.map(()=>ges.P&&graphToDot(ges.P, graphLabels))),
    ]);
    return;
  });

  const exported = mainBody(
    tabsData,
    GesElem,
  );

  putLoader.exportDefault(exported);
})()