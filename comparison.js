"use strict";

const catalog = {
  20: [
    {id:"e0",label:"E0 · 原生 1×",note:"832 × 480 生成；bicubic 放大仅用于同尺寸观看。"},
    {id:"e1",label:"E1 · Direct 2×",note:"原始空间与时间 RoPE；直接 2×。"},
    {id:"e2",label:"E2 · AR-RoPE",note:"CineScale 组件适配；不是论文完整复现。"},
    {id:"e3",label:"E3 · Inward Window",note:"FreeSwim 组件适配；不是论文完整复现。"},
    {id:"e6",label:"E6 · MemRoPE",note:"Krea 适配版；缓存、历史处理和 RoPE 与 E1 不同。"}
  ],
  50: [
    {id:"e1",label:"E1 · Direct 2×",note:"50 秒；68 块生成 810 帧，裁切为 800 帧。",config:true},
    {id:"e6",label:"E6 · MemRoPE",note:"50 秒；68 块生成 810 帧，裁切为 800 帧。",config:true}
  ]
};
const labels = ["骑行 / 砖墙","织物摊 / 展布","人犬 / 公园","陶艺 / 旋转","木船 / 水纹"];
const state = {duration:50,inputs:[],caseIndex:0,selected:{"20":["e1","e6"],"50":["e1","e6"]},videos:[],frame:null,playing:false,targetTime:0};
const $ = selector => document.querySelector(selector);
const clock = seconds => {
  const n = Math.max(0,Math.floor(seconds));
  return String(Math.floor(n/60)).padStart(2,"0") + ":" + String(n%60).padStart(2,"0");
};
const url = path => new URL(path,location.href).href;
const mediaUrl = name => new URL(name,window.KREA_SITE_CONFIG.releaseBase).href;
const make = (tag,className,text) => {
  const element = document.createElement(tag);
  if(className) element.className = className;
  if(text !== undefined) element.textContent = text;
  return element;
};
function stop(){
  if(state.frame !== null) cancelAnimationFrame(state.frame);
  state.frame = null;
  state.playing = false;
  state.videos.forEach(video => video.pause());
}
function updateTime(value){
  const duration = state.duration;
  const time = Math.max(0,Math.min(duration,value || 0));
  $("#time").textContent = clock(time) + " / " + clock(duration);
  $("#seek").value = String(Math.round(time*16));
  const current = Math.min(Math.floor(time/(duration===50?10:5)),duration===50?4:3);
  document.querySelectorAll("#segments button").forEach((button,index) => button.classList.toggle("active",index===current));
}
function tick(){
  if(!state.playing) return;
  const anchor = state.videos[0];
  if(!anchor) return;
  const t = anchor.currentTime;
  state.targetTime = t;
  state.videos.slice(1).forEach(video => {
    if(video.readyState >= 1 && Math.abs(video.currentTime-t) > .2) video.currentTime = t;
  });
  updateTime(t);
  if(anchor.ended){stop();return}
  state.frame = requestAnimationFrame(tick);
}
function jumpTo(seconds){
  const time = Math.max(0,Math.min(state.duration,seconds));
  state.targetTime = time;
  state.videos.forEach(video => { if(video.readyState >= 1) video.currentTime = time; });
  updateTime(time);
}
function addLink(container,label,path,download){
  const link = make("a",null,label);
  link.href = url(path);
  link.target = "_blank";
  link.rel = "noopener";
  if(download) link.download = "";
  container.append(link);
}
function renderMethods(){
  const container = $("#method-options");
  container.replaceChildren();
  const selected = state.selected[String(state.duration)];
  for(const method of catalog[state.duration]){
    const button = make("button","method",method.label);
    button.type = "button";
    button.setAttribute("aria-pressed",String(selected.includes(method.id)));
    button.onclick = () => {
      if(selected.includes(method.id)){
        if(selected.length===1) return;
        state.selected[String(state.duration)] = selected.filter(id => id!==method.id);
      }else{
        if(selected.length===3) selected.shift();
        selected.push(method.id);
      }
      renderMethods();
      render();
    };
    container.append(button);
  }
}
function renderSegments(){
  const container = $("#segments");
  container.replaceChildren();
  const step = state.duration===50?10:5;
  for(let start=0;start<state.duration;start+=step){
    const button = make("button",null,start+"–"+(start+step)+" 秒");
    button.type = "button";
    button.onclick = () => jumpTo(start);
    container.append(button);
  }
  $("#seek").max = String(state.duration*16);
  updateTime(0);
}
function render(){
  stop();
  state.targetTime = 0;
  state.videos.forEach(video => {video.removeAttribute("src");video.load()});
  state.videos = [];
  const sample = state.inputs[state.caseIndex];
  if(!sample) return;
  $("#case-select").value = sample.original_id;
  $("#prompt").textContent = sample.prompt;
  $("#seed").textContent = sample.original_id+" · seed "+sample.seed;
  const info = state.duration===50 ?
    [["输出","800 帧 · 50 秒 · 16 fps"],["生成","68 块 · 810 帧 · 尾部裁切 10 帧"],["分辨率","1664 × 960 RGB"],["输入","五组固定 prompt 与 seed"]] :
    [["输出","320 帧 · 20 秒 · 16 fps"],["方法","E0 / E1 / E2 / E3 / E6"],["分辨率","E0 原生 832 × 480；其他 1664 × 960"],["输入","五组固定 prompt 与 seed"]];
  const params = $("#params");
  params.replaceChildren();
  info.forEach(pair => {params.append(make("dt",null,pair[0]),make("dd",null,pair[1]))});
  const cards = $("#cards");
  cards.replaceChildren();
  const chosen = catalog[state.duration].filter(method => state.selected[String(state.duration)].includes(method.id));
  cards.style.setProperty("--columns",String(chosen.length));
  for(const method of chosen){
    const prefix = "data/"+state.duration+"s/"+method.id+"/"+sample.original_id+"/";
    const asset = method.id+"_"+state.duration+"s_"+sample.original_id+".mp4";
    const card = make("article","card");
    const head = make("div","card-head");
    const title = make("div");
    title.append(make("span","card-index",method.id.toUpperCase()+" / "+state.duration+" SECONDS"),make("h3",null,method.label));
    head.append(title,make("span","card-size",method.id==="e0"?"832×480 → 2×":"1664×960"));
    const video = make("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = mediaUrl(asset);
    video.playbackRate = Number($("#speed").value);
    video.setAttribute("aria-label",method.label+" "+sample.original_id+" 视频");
    video.addEventListener("error",() => {$("#status").textContent = "媒体加载失败："+method.label+" / "+sample.original_id+"。请检查文件。"});
    video.addEventListener("loadedmetadata",() => {
      if(state.targetTime>0) video.currentTime = state.targetTime;
      if(!state.playing) updateTime(state.targetTime);
    });
    card.append(head,video);
    const foot = make("div","card-foot");
    foot.append(make("p",null,method.note));
    const links = make("div","card-links");
    addLink(links,"打开 MP4",mediaUrl(asset),false);
    addLink(links,"运行摘要",prefix+"metadata.json",false);
    if(method.config) addLink(links,"生效配置",prefix+"run_config.json",false);
    if(method.id==="e0") addLink(links,"E0 原生视频",mediaUrl("e0_20s_"+sample.original_id+"_native.mp4"),false);
    foot.append(links);
    card.append(foot);
    cards.append(card);
    state.videos.push(video);
  }
  ["#play","#pause","#restart","#seek"].forEach(selector => {$(selector).disabled = state.videos.length===0});
  $("#status").textContent = "已选择 "+state.videos.length+" 条视频；按固定时间段定位或同步播放。";
  renderSegments();
}
async function init(){
  try{
    const response = await fetch("motion_five.json",{cache:"no-store"});
    if(!response.ok) throw new Error("HTTP "+response.status);
    const inputs = await response.json();
    if(!Array.isArray(inputs) || inputs.length!==5 || inputs.some((item,index) => item.original_id!=="motion_0"+(index+1) || !Number.isInteger(item.seed) || !item.prompt)) throw new Error("五组输入不完整");
    state.inputs = inputs;
    inputs.forEach((sample,index) => {
      const option = make("option",null,sample.original_id+" · "+labels[index]);
      option.value = sample.original_id;
      $("#case-select").append(option);
    });
    $("#case-select").onchange = event => {state.caseIndex = inputs.findIndex(item => item.original_id===event.target.value);render()};
    document.querySelectorAll("[data-duration]").forEach(button => {
      button.onclick = () => {
        state.duration = Number(button.dataset.duration);
        document.querySelectorAll("[data-duration]").forEach(other => other.setAttribute("aria-pressed",String(other===button)));
        renderMethods();
        render();
      };
    });
    $("#play").onclick = async () => {
      try{
        const first = state.videos[0];
        const t = first && first.readyState>=1 ? first.currentTime : state.targetTime;
        state.videos.forEach(video => {video.currentTime=t;video.playbackRate=Number($("#speed").value)});
        await Promise.all(state.videos.map(video => video.play()));
        state.playing = true;
        state.frame = requestAnimationFrame(tick);
      }catch(error){stop();$("#status").textContent = "播放失败："+error.message}
    };
    $("#pause").onclick = () => {stop();updateTime(state.videos[0]?.currentTime || 0)};
    $("#restart").onclick = () => jumpTo(0);
    $("#seek").oninput = event => jumpTo(Number(event.target.value)/16);
    $("#speed").onchange = event => state.videos.forEach(video => {video.playbackRate=Number(event.target.value)});
    renderMethods();
    render();
  }catch(error){$("#status").textContent = "案例资料加载失败："+error.message}
}
init();
