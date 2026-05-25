/* Nyx8266 WebUI - scan.js */
var nameJson=[];
var scanJson={aps:[],stations:[]};

function sigBars(rssi){
  var pct=Math.min(100,Math.max(0,rssi+100));
  var cls=pct>60?"g":pct>35?"y":"r";
  return "<div class=meter><div class='meter-fill "+cls+"' style='width:"+pct+"%'></div></div>"
        +"<span style='font-size:.7rem;color:var(--muted);margin-left:4px'>"+rssi+"</span>";
}

function drawScan(){
  var html,sel,ap;
  getE("apNum").textContent=scanJson.aps.length;
  html="<tr><th></th><th>SSID</th><th class=hide-sm>Ch</th><th>Signal</th><th class=hide-sm>Enc</th><th class=hide-sm>MAC</th><th></th><th></th></tr>";
  for(var i=0;i<scanJson.aps.length;i++){
    sel=scanJson.aps[i][7];
    html+=(sel?"<tr class=selected>":"<tr>")
      +"<td>"+(sel?"🔒":"")+"</td>"
      +"<td><b>"+esc(scanJson.aps[i][0])+"</b></td>"
      +"<td class=hide-sm>"+esc(scanJson.aps[i][2])+"</td>"
      +"<td>"+sigBars(scanJson.aps[i][3])+"</td>"
      +"<td class=hide-sm>"+esc(scanJson.aps[i][4])+"</td>"
      +"<td class=hide-sm style='font-size:.72rem'>"+esc(scanJson.aps[i][5])+"</td>"
      +"<td><label class=checkBoxContainer><input type=checkbox "+(sel?"checked":"")+" onclick='selectRow(0,"+i+","+(sel?"false":"true")+")' /><span class=checkmark></span></label></td>"
      +"<td><button class='danger sm-btn' onclick='remove(0,"+i+")'>✕</button></td>"
      +"</tr>";
  }
  getE("apTable").innerHTML=html;

  getE("stNum").textContent=scanJson.stations.length;
  html="<tr><th></th><th class=hide-sm>Vendor</th><th>MAC</th><th class=hide-sm>Ch</th><th class=hide-sm>Pkts</th><th>AP</th><th></th><th></th></tr>";
  for(var i=0;i<scanJson.stations.length;i++){
    sel=scanJson.stations[i][7];
    ap="";
    if(scanJson.stations[i][5]>=0 && scanJson.aps[scanJson.stations[i][5]])
      ap=esc(scanJson.aps[scanJson.stations[i][5]][0]);
    html+=(sel?"<tr class=selected>":"<tr>")
      +"<td></td>"
      +"<td class=hide-sm style='font-size:.72rem'>"+esc(scanJson.stations[i][3])+"</td>"
      +"<td style='font-size:.75rem'>"+esc(scanJson.stations[i][0])+"</td>"
      +"<td class=hide-sm>"+esc(scanJson.stations[i][1])+"</td>"
      +"<td class=hide-sm>"+esc(scanJson.stations[i][4])+"</td>"
      +"<td>"+ap+"</td>"
      +"<td><label class=checkBoxContainer><input type=checkbox "+(sel?"checked":"")+" onclick='selectRow(1,"+i+","+(sel?"false":"true")+")' /><span class=checkmark></span></label></td>"
      +"<td><button class='danger sm-btn' onclick='remove(1,"+i+")'>✕</button></td>"
      +"</tr>";
  }
  getE("stTable").innerHTML=html;
}

function drawNames(){
  var html,sel;
  getE("nNum").textContent=nameJson.length;
  html="<tr><th></th><th>MAC</th><th class=hide-sm>Vendor</th><th>Name</th><th class=hide-sm>Ch</th><th></th><th></th><th></th></tr>";
  for(var i=0;i<nameJson.length;i++){
    sel=nameJson[i][5];
    html+=(sel?"<tr class=selected>":"<tr>")
      +"<td></td>"
      +"<td contenteditable=true id='name_"+i+"_mac' style='font-size:.72rem'>"+esc(nameJson[i][0])+"</td>"
      +"<td class=hide-sm style='font-size:.72rem'>"+esc(nameJson[i][1])+"</td>"
      +"<td contenteditable=true id='name_"+i+"_name'>"+esc(nameJson[i][2].substring(0,16))+"</td>"
      +"<td class=hide-sm contenteditable=true id='name_"+i+"_ch'>"+esc(nameJson[i][4])+"</td>"
      +"<td><input type=hidden id='name_"+i+"_apbssid' value='"+esc(nameJson[i][3])+"'></td>"
      +"<td><button class='success sm-btn' onclick='save("+i+")'>Save</button></td>"
      +"<td><label class=checkBoxContainer><input type=checkbox "+(sel?"checked":"")+" onclick='selectRow(2,"+i+","+(sel?"false":"true")+")' /><span class=checkmark></span></label></td>"
      +"<td><button class='danger sm-btn' onclick='remove(2,"+i+")'>✕</button></td>"
      +"</tr>";
  }
  getE("nTable").innerHTML=html;
}

var duts,elxtime;
function scan(type){
  getE("RButton").disabled=true;
  if(type===0){getE("scanOne").disabled=true;getE("scanZero").style.opacity=".4";elxtime=2450;}
  else{getE("scanZero").disabled=true;getE("scanOne").style.opacity=".4";elxtime=parseInt(getE("scanTime").value+"000")+1500;}
  var cmd="scan "+(type===0?"aps ":"stations -t "+getE("scanTime").value+"s")+" -ch "+getE("ch").options[getE("ch").selectedIndex].value;
  getFile("run?cmd="+cmd);
  duts=type;
  setTimeout(buttonFunc,elxtime);
  setTimeout(load,elxtime);
}

function buttonFunc(){
  if(duts===0){getE("scanZero").style.opacity="1";getE("scanOne").disabled=false;}
  else{getE("scanOne").style.opacity="1";getE("scanZero").disabled=false;}
  getE("RButton").disabled=false;
}

function load(){
  getFile("run?cmd=save scan",function(){
    getFile("scan.json",function(r){
      try{scanJson=JSON.parse(r);}catch(e){return;}
      showMessage("OK"); drawScan();
    });
  });
  getFile("run?cmd=save names",function(){
    getFile("names.json",function(r){
      try{nameJson=JSON.parse(r);}catch(e){return;}
      showMessage("OK"); drawNames();
    });
  });
}

function selectRow(type,id,sel){
  if(type===0){scanJson.aps[id][7]=sel;drawScan();getFile("run?cmd="+(sel?"":"de")+"select ap "+id);}
  else if(type===1){scanJson.stations[id][7]=sel;drawScan();getFile("run?cmd="+(sel?"":"de")+"select station "+id);}
  else{save(id);nameJson[id][5]=sel;drawNames();getFile("run?cmd="+(sel?"":"de")+"select name "+id);}
}

function remove(type,id){
  if(type===0){scanJson.aps.splice(id,1);drawScan();getFile("run?cmd=remove ap "+id);}
  else if(type===1){scanJson.stations.splice(id,1);drawScan();getFile("run?cmd=remove station "+id);}
  else{nameJson.splice(id,1);drawNames();getFile("run?cmd=remove name "+id);}
}

function save(id){
  var mac=getE("name_"+id+"_mac").textContent.replace("<br>","").trim();
  var name=getE("name_"+id+"_name").textContent.replace("<br>","").trim();
  var apbssid=getE("name_"+id+"_apbssid").value;
  var ch=getE("name_"+id+"_ch").textContent.replace("<br>","").trim();
  if(mac!=nameJson[id][0]||name!=nameJson[id][2]||ch!=nameJson[id][4]){
    nameJson[id][0]=mac; nameJson[id][2]=name; nameJson[id][3]=apbssid; nameJson[id][4]=ch;
    if(mac.length!=17){showMessage("ERROR:MAC invalid");return;}
    getFile("run?cmd=replace name "+id+" -n \""+nameJson[id][2]+"\" -m \""+nameJson[id][0]+"\" -ch "+nameJson[id][4]+" -b \""+nameJson[id][3]+"\" "+(nameJson[id][5]?"-s":""));
    drawNames();
  }
}

function add(type,id){
  if(type===2){
    if(nameJson.length>=25){showMessage("ERROR:Device Name List full");return;}
    getFile("run?cmd=add name device_"+nameJson.length+" -m 00:00:00:00:00:00 -ch 1");
    nameJson.push(["00:00:00:00:00:00","","device_"+nameJson.length,"",1,false]);
    drawNames(); return;
  }
  if(nameJson.length>=25){showMessage("ERROR:Device Name List full");return;}
  if(type===0){
    getFile("run?cmd=add name \""+scanJson.aps[id][0]+"\" -ap "+id);
    scanJson.aps[id][1]=scanJson.aps[id][0];
    nameJson.push([scanJson.aps[id][5],scanJson.aps[id][6],scanJson.aps[id][0],"",scanJson.aps[id][2],false]);
  } else {
    getFile("run?cmd=add name \""+scanJson.stations[id][0]+"\" -st "+id);
    scanJson.stations[id][2]="device_"+nameJson.length;
    var apIdx=scanJson.stations[id][5];
    var apMac=(apIdx>=0&&scanJson.aps[apIdx])?scanJson.aps[apIdx][5]:"";
    nameJson.push([scanJson.stations[id][0],scanJson.stations[id][3],"device_"+nameJson.length,apMac,scanJson.stations[id][1],false]);
  }
  drawScan(); drawNames();
}

function selectAll(type,sel){
  if(type===0){getFile("run?cmd="+(sel?"":"de")+"select aps");for(var i=0;i<scanJson.aps.length;i++)scanJson.aps[i][7]=sel;drawScan();}
  else if(type===1){getFile("run?cmd="+(sel?"":"de")+"select stations");for(var i=0;i<scanJson.stations.length;i++)scanJson.stations[i][7]=sel;drawScan();}
  else{getFile("run?cmd="+(sel?"":"de")+"select names");for(var i=0;i<nameJson.length;i++)nameJson[i][5]=sel;drawNames();}
}
