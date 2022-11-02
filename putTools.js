//@ts-check

/** @typedef {string|number|boolean|object} RenderConstant0 */
/** @typedef {RenderConstant0|RX<RenderConstant0>} RenderConstant1 */
/** @typedef {Node|RenderConstant1} RenderConstant2 */
/** @typedef {RenderConstant2|RenderConstant2[]} RenderConstant3 */

async function sleep(/** @type {number}*/ ms) {
  await new Promise((ok, err) => setTimeout(ok, ms));
}

async function until(/** @type {()=>any}*/ func, { ms = 200, timeout = 0 } = {}) {
  if (timeout && ms > timeout) ms = timeout / 10;
  let t0 = (new Date()).getTime();
  let value;
  while (!(value = await func())) {
    if (timeout && (new Date()).getTime()-t0 > timeout)
      throw 'timeout';
    await sleep(ms);
  }
  return value;
}

/** @template T @param {T} value @returns {T extends null ? never : T extends undefined ? never : T} */
function nonNull(value) {
  if (!value && (value===null||value === undefined)) throw new Error(`Encountered unexpected undefined value`);
  return /** @type {*} */ (value);
}



let putFlatten = (/** @type {Node|Node[]} */ fragment)=>{
  const flat = [];
  const flatten = (/** @type {Node|Node[]} */ arr)=>{
    if(Array.isArray(arr)) arr.forEach(e=> flatten(e));
    else if(arr instanceof Node) flat.push(arr);
    else if(arr || arr==0 ) flat.push(putText(arr));
  }
  flatten(fragment)
  return flat;
}

let putLoader = new class {
  __promises = {}

  /**
   * @param {string} src
   * @param {HTMLElement?} elem_
   * @param {'replace'|'last-child'} where
   */
   mount(src, elem_=null, where='last-child'){
    let elem = elem_||document.body;
    if(where!='replace'){
      const child = put('div');
      elem.appendChild(child);
      elem = child;
    }
    // Resolve src
    const script = put('script[src=$]', src);
    src = script['src'];

    if(!this.__promises[src]){
      let resolve, reject;
      const promise = new Promise((resolve_, reject_)=>{
        resolve = resolve_;
        reject = reject_;
      })
      let entry = {promise, resolve, reject, fulfilled:false};
      this.__promises[src] = entry;
      document.head.appendChild(script);
      setTimeout(()=>{
        if(entry.fulfilled) return;
        const animationTimer$ = new RX(0);
        const animationId = setInterval(()=>{
          animationTimer$.set(animationTimer$.value+1);
          if(entry.fulfilled) clearInterval(animationId);
        }, 100);
        if(entry.fulfilled) return;
        elem.append(
          putText(animationTimer$.map(t=>
            `(${['/', '\\'][t%2]}Loading component${['/', '\\'][t%2]})`
          )),
        )
        setTimeout(()=>{
          if(entry.fulfilled) return;
          elem.replaceChildren(
            putText('Loading failed. Try reloading the page.'),
          );
          console.error(`Timeout for src=${src}`);
          clearInterval(animationId);
        }, 5000);
      }, 1000)
    }
    // Await for the script to run putLoader.exportDefault(()=> ... );
    this.__promises[src].promise.then(fragment=>
      elem.replaceWith(...putFlatten(fragment))
    );
  }
  /**
   * @param {(Node|Node[])} fragment
   */
  exportDefault(fragment){
    let script = document.currentScript;
    let entry = this.__promises[(script||{})['src']];
    if(entry.fulfilled) return console.error("Can not export multiple objects");
    entry.resolve(fragment);
    entry.fulfilled = true;
  }

  /**
   * @param {string} src
   */
   async require(key, src){
    if(window[key]) return window[key];
    // Resolve src
    const script = put('script[src=$]', src);
    src = script['src'];
    if(!this.__promises[src]){
      let resolve, reject;
      const promise = new Promise((resolve_, reject_)=>{
        resolve = resolve_;
        reject = reject_;
      })
      let entry = {promise, resolve, reject, fulfilled:false};
      this.__promises[src] = entry;
      document.head.appendChild(script);
      let out = await until(()=>window[key]);
      (await until(()=>entry.resolve))(out);
      entry.fulfilled = true;
    } else if(!this.__promises[src].fulfilled){
      return await this.__promises[src].promise;
    }
    return window[key];
  }

}



var /** @type {(...args)=>HTMLElement}*/ put = eval("window['put']");
var /** @type {*}*/ katex = eval("window['katex']");
var /** @type {*}*/ d3 = eval("window['d3']");

document.head.append(put('style', `
.parBreak { margin-top:1em; }
`));

/** 
 * @param {TemplateStringsArray} htmlTemplateString
 * @param {RenderConstant3[]} variables
 * @returns {Node[]}
 * */
function putNodes(htmlTemplateString, ...variables){
  let wrapper = document.createElement('div');
  let /** @type {readonly string[]}*/ htmlSeq = (htmlTemplateString.raw||htmlTemplateString);
  let html = htmlSeq.join('<div placeholderForPutVariable></div>')

  html = html.replace(/<!--.*?-->/gs, ''); // Comments shift placeholder replacements

  const codes = [];
  html = html.replace(/\\\`\\\`\\\`(.*?)\\\`\\\`\\\`/gs, m=>{
    codes.push(m.slice(6,-6).trim());
    return '<div placeholderForPutVariable="code"></div>'
  });
  html = html.replace(/\\\`(.*?)\\\`/g, '<code>$1</code>');

  const formulas = [];
  html = html.replace(/(\$\$.*?\$\$|\$.*?\$)/gs, m=>{
    const displayMode = m.startsWith("$$");
    const skip = displayMode?2:1;
    formulas.push({displayMode, formula:m.slice(skip, -skip)});
    return '<div placeholderForPutVariable="formula"></div>'
  });

  html = html.replace(/\s*\n(\s*\n)+/g, '<div class="parBreak"></div>');

  wrapper.innerHTML = html;
  let varIndex = 0;
  let formulaIndex = 0;
  let codeIndex = 0;
  let replacements = [];
  let mathReplacements = [];
  let codeReplacements = [];
  const dfs = (/** @type {Node}*/root)=>{
    for(let child of root.childNodes){
      const isPlaceholder = (
        child.nodeName=="DIV"
        && child instanceof HTMLElement
        && child.attributes['placeholderForPutVariable']
      );
      if(!isPlaceholder) dfs(child);
      else if(isPlaceholder.value=='formula'){
        mathReplacements.push({element:child, value: formulas[formulaIndex++]})
      } else if(isPlaceholder.value=='code'){
        codeReplacements.push({element:child, value: codes[codeIndex++]})
      } else {
        replacements.push({element:child, value: variables[varIndex++]});
      }
    }
  }
  dfs(wrapper);

  for(let {element, value} of replacements){
    let values = (Array.isArray(value)? value:[value]).map(v=>{
      if(v instanceof Node) return v;
      if(v instanceof RX) return putText(v);
      return putText(v);
    });
    element.replaceWith(.../**@type {*}*/(values));
  }
  for(let {element, value} of mathReplacements){
    let {displayMode, formula} = value;
    katex.render(formula, element, {throwOnError: false, displayMode});
    element.replaceWith(element.firstChild);
  }
  for(let {element, value} of codeReplacements){
    const options = {mode:'text/javascript'};
    const code = value.replace(/^.*?\n(.*)$/gs, '$1');
    element.replaceWith(putCodemirror(code, options));
  }
  // DOES NOT WORK for td nor th!!!
  return [...wrapper.childNodes];
}
/** 
 * @param {TemplateStringsArray} htmlTemplateString
 * @param {RenderConstant3[]} variables
 * @returns {HTMLElement}
 * */
var putElem = (htmlTemplateString, ...variables) =>{
  const nodes = putNodes(htmlTemplateString, ...variables);
  for(let node of nodes){
    if(node instanceof HTMLElement) return node;
  }
  console.log(nodes);
  throw `no element in template: ${htmlTemplateString.join('{{VAR}}')}}`;
}


/** 
 * @param {RenderConstant1} text$
 * @returns {Text}
 * */
function putText(text$){
  const parseText = (v)=>{
    if (typeof v === 'string') return v;
    if(v instanceof String) return v.toString();
    if(Number.isFinite(v)) return `${v}`;
    if(!v) '';
    return JSON.stringify(v);
  }
  const elem = document.createTextNode('');
  if(text$ instanceof RX) text$.subscribe(text => elem.textContent=parseText(text));
  else elem.textContent=parseText(text$);
  return elem;
}




document.head.append(put('style', `
.CodeMirror{
  height: 100%;
}
`));
function putCodemirror(code, options){
  const id = 'codemirror-'+(''+Math.random()).slice(2);
  document.head.append(put('style', `
  #${id} .CodeMirror{height: 100%;}
  `));
  const codeDiv = put(`div#${id}`);
  until(() => document.querySelector(`#${id}`)).then(() => {
    options = Object.assign({
      unindent: true,
      keyMap: 'sublime',
      theme: 'default',
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      lineNumbers: true,
      scrollPastEnd: false,
      autoRefresh: true,
    }, options);
    window["CodeMirror"](codeDiv, {value: code, ...options});
  });
  return codeDiv;
}





/** @template T */
class RX {
  value;
  actions;
  /**
   * @param {T} value
   * @param {string?} localStorageKey
   * */
  constructor(value, localStorageKey=null){
    this.actions = /** @type {((arg:T)=>*)[]}*/([]);
    if(localStorageKey == null) this.value = value;
    else {
      const key = localStorageKey;
      this.value = JSON.parse(localStorage.getItem(key)||JSON.stringify(value));
      this.silentSubscribe((newValue)=>localStorage.setItem(key, JSON.stringify(newValue))) 
    } 
  }
  /** @param {(arg:T)=>*} action*/
  silentSubscribe(action){
    this.actions.push(action);
    return action;
  }
  /** @param {(arg:T)=>*} action*/
  subscribe(action){
    this.silentSubscribe(action);
    action(this.value);
    return action;
  }
  /** @param {(arg:T)=>*} action*/
  subscribeOnce(action){
    this.actions.push(action);
    this._once.push(action);
    return action;
  }
  _once = [];

  /** @param {T} value*/
  set(value){ this._set(value); }
  /** @param {T} value*/
  _set(value){ // Exists just to differentiate from readonly
    if(value!==this.value){
      this.value = value;
      this.notify();
    }
    return value;
  }
  notify(){// Notifies all listeners
    let anyErr = null
    for(let action of this.actions){
      try{ action(this.value); }
      catch(err){ console.warn(anyErr=err||action.toString()); }
    }
    while(this._once.length) this.unsubscribe(this._once.pop());
    if(anyErr) throw anyErr;
  }

  /**
   * @template T2 
   * @param {(arg:T)=>T2} f
   * @returns {RX_readonly<T2>}
   */
  map(f){
    const out = new RX_readonly(f(this.value));
    const sub = this.silentSubscribe(value=>out._set(f(value)));
    this._maps.push([out, f, sub]);
    return out;
  }
  _maps = [];

  /** @param {RX<*>} rxs*/
  /** @returns {RX<*[]>}*/
  static or(...rxs){
    const obj = new RX(rxs.map(x=>x.value));
    for(let i in rxs) rxs[i].silentSubscribe(x=>obj.set((obj.value[i]=x, [...obj.value])))
    return obj;
  }
  /** @param {RX|*} rxs*/
  /** @returns {RX<*>} */
  static asRX(rx_or_constant){
    return (rx_or_constant instanceof RX)? rx_or_constant: new RX_constant(rx_or_constant);
  }

  static trigger(){ return new RX_trigger(0); }

  /** @template T2
   * @param {string} key
   * @param {T2} defaultValue
   * @returns {RX<T2>}
  */
  static locallyStored(key, defaultValue){
    const value = JSON.parse(localStorage.getItem(key)||JSON.stringify(defaultValue));
    const rx = new RX(value);
    rx.silentSubscribe((newValue)=>localStorage.setItem(key, JSON.stringify(newValue)))
    return rx;
  }


  /** @param {RX_readonly<T>} newSource$*/
  remapMappings(newSource$){
    for(let [rx, f, sub] of this._maps){
      this.unsubscribe(sub);
      const newSub = newSource$.subscribe(value=>rx._set(f(value)));
      newSource$._maps.push([rx, f, newSub]);
    } 
    return newSource$;
  }
  unsubscribe(action){
    this.actions = this.actions.filter(a=> a!=action);
  }
}

/** @template T */
class RX_readonly extends RX{
  set(value){ throw 'readonly object' };
}

/** @template T */
class RX_constant extends RX{
  silentSubscribe(action){ return action; }
}
/** @template T */
class RX_trigger extends RX{
  trigger(){
    this.set(this.value+1);
  }
}


document.head.append(put('style', `
.switch-hidden{
  display: none
}`));
const Switch = ({key$}, ...children)=>{
  children = children.map(child=>({
    caseKey: child.attributes['case']?.value,
    isDefault: !!child.attributes['default'],
    elem: child,
  }));
  key$.subscribe(key => {
    const anyMatch = children.filter(({caseKey})=>caseKey==key).length > 0;
    for(let {caseKey, isDefault, elem} of children){
      let show;
      if(key===true) show=true;
      else if(key===false) show=false;
      else if(!caseKey || caseKey==key) show=true;
      else if(!anyMatch && isDefault) show=true;
      else show=false;
      put(elem, show?`!switch-hidden`:`.switch-hidden`);
    }
  });
  return children.map(({elem})=>elem);
}


// tab effects: https://alvarotrigo.com/blog/html-css-tabs/
document.head.append(put('style', `
.tabs-header>label>input { display: none; }
.tabs-parent { width: 100%; }
.tabs-header {
  margin-top: 0.1em;
  border-bottom: 1px solid;
}
.tab-label:hover {
  top: -0.25rem;
  transition: top 0.25s;
}
.tabs{
  border: solid 1px;
  border-top: none;
}
.tab-label {
  padding-left: 1em;
  padding-right: 1em;
  border-radius: 0.3em 0.3em 0 0;
  background: unset;
  border: solid 1px;
  white-space:nowrap;
  cursor: pointer;
}
/* https://stackoverflow.com/a/10148189/3671939 */
.tab-label { white-space:nowrap; }
.tab-label > span{ white-space: normal; }

.tab-label-true {
  font-weight: bold;
  border-bottom: solid 2px #EBEBEB;
}
.tab-content-false { display:none; }
.tab-content-true {
  display: true;
  opacity: 1;
	animation-name: fadeInOpacity;
	animation-iteration-count: 1;
	animation-timing-function: ease-in;
	animation-duration: 0.15s;
}
@keyframes fadeInOpacity {
	0% { opacity: 0; }
	100% { opacity: 1;}
}
.tab-content-true { padding: 1vw; }
`));
/** @param {{entries: [string,string][], defaultKey?:string, localStorageKey?:string}} settings */
const Tabs = ({entries, defaultKey, localStorageKey}, ...children)=>{
  const option$ = localStorageKey?
    RX.locallyStored(localStorageKey, defaultKey||entries[0][0])
    : new RX(defaultKey||entries[0][0]);
  let zEntries = entries.map(([key, value])=>(
    {key, label$: RX.asRX(value), elem:put('input[type="radio"]')}
  ));
  const head = zEntries.map(({key, label$})=>{
    let input, span;
    const elem = put('label.tab-label', [
      input=put('input[type=radio]'),
      span=put('span'),
    ]);
    label$.subscribe(label=>span.textContent=label);
    elem.onclick = ()=>option$.set(key);
    return {key, label$, elem, input};
  });
  children = children.map(child=>({
    key: child.attributes['tab']?.value,
    elem: child,
  }));
  option$.subscribe((option)=>{
    for(let {elem, key, input} of head){
      put(input, option==key?'[checked]':'[!checked]')
      put(elem, `.tab-label-${option==key}!tab-label-${option!=key}`)
    }
    for(let {elem, key} of children){
      put(elem, `.tab-content-${option==key}!tab-content-${option!=key}`)
    }
  });
  return putNodes`
  <div class="tabs-parent">
    <div class="tabs-header">
      ${head.map(({elem})=>elem)}
    </div>
    <div class="tabs">
      ${children.map(({elem})=>elem)}
    </div>
  </>`;
}



// styling: https://stackoverflow.com/a/10148189/3671939
document.head.append(put('style', `
div.radio-group{
  display: flex;
  flex-wrap: wrap;
}
div.radio-group > label{
  margin-left:0.25em;
  margin-right:0.25em;
  white-space: nowrap;
}
div.radio-group > label > span{
  white-space: normal;
}
`));
/**
 * 
 * @param {[string, string][]} entries 
 * @param {RX<string>?} choice$ 
 * @returns 
 */
function RadioGroup(entries, choice$=null){
  let _choice$ = choice$ || new RX(entries[0][0]);
  const zEntries = entries.map(([key, value])=>{
    const label$ = RX.asRX(value);
    const input = put('input[type="radio"]');
    const container = put('label', [input, putText(label$)])
    container.onclick = (()=>_choice$.set(key));
    return {key, input, container};
  });
  _choice$.subscribe(choice=>{
    for(let {key, input} of zEntries){
      put(input, choice==key?'[checked]':'[!checked]');
    }
  })
  return put('div.radio-group', zEntries.map(({container})=>container));
}



document.head.append(put('style', `
.main-component{ padding: 1% 6% 3% 6%; max-width: 40em; margin: auto;}
.main-component-parent{
  font-family: Latin Modern Roman, Computer Modern Roman, serif;
  font-size: 1.2rem;
  padding-top: 1em;
}
.main-empty-bottom{ padding-bottom: calc(20vh + 5rem); }
code{ font-size: 0.8em; white-space: pre-wrap; }
.CodeMirror{ font-size: 0.8em; }
`))
function mainBody(...children){
  return putNodes`
    <div class="main-component-parent">
      <div class="main-component">
        ${children}
        <div class="main-empty-bottom" />
      </div>
    </div>
  `;
}


document.head.append(put('style', `
.graphviz-hidden {
  display: none;
}
.dotGraphViz {
  text-align: center;
  background-color: #EBEBEB; overflow-x:clip;
  box-shadow: 0px 0px 3px 0px grey;
  margin: 5px;
  cursor: move;
}`));
const DotGraphViz = (dotCode$)=>{
  const graphId = (''+Math.random()).slice(2);
  const graphDiv = put(`div.dotGraphViz`, put(`div#graph${graphId}`));
  dotCode$.subscribe(async (dotCode)=>{
    if(!dotCode) put(graphDiv, '.graphviz-hidden');
    else{
      put(graphDiv, '!graphviz-hidden');
      await until(()=>d3.select(`#graph${graphId}`));
      d3.select(`#graph${graphId}`).graphviz().renderDot(dotCode);
    }
  });
  return graphDiv;
}

const graphToDot = (/** @type {null|PDAG} */ P, labels=null)=>{
  const vizMessage = (msg)=>`graph G{\nbgcolor=lightgray\ncolor=black\n a [label="${msg}"]; }`;
  if(!P) return vizMessage("No graph to show");
  if(P.n >= 60) return vizMessage(`Too large to be displayed: ${P.n} nodes`);
  let arrows = [];
  for(let a=0;a<P.n;a++) for(let b=a+1;b<P.n;b++){
    if(P.mat[a][b]||P.mat[b][a]){
      if(!P.mat[a][b]) arrows.push(`${b} -> ${a};`); 
      else if(!P.mat[b][a]) arrows.push(`${a} -> ${b};`); 
      else arrows.push(`${b} -> ${a} [dir=none];`); 
    }
  }
  const sNodes = d3.range(P.n).map(i=>`${i} [label="${labels?labels[i]:`X${i+1}`}"];`).join('\n');
  const sArrows = arrows.join('\n');
  return `
  digraph G{
    bgcolor="#eeeeee"
    node [fontcolor="#000000"];
    edge [color="#000000"];
    ${sNodes}
    ${sArrows}
  }`
}


var utils = (()=>{
  const zeros = (...sizes)=>{
    let arr = Array(sizes[0]).fill(0);
    if(sizes.length==1) return arr;
    else return arr.map(()=>zeros(...sizes.slice(1)));
  }
  return {zeros}
})();
