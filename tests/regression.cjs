const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const dir=path.resolve(__dirname,'..'),out=path.join(dir,'.tmp','regression-qa');fs.mkdirSync(out,{recursive:true});
const html=path.join(dir,'exam-maker.html');
const results=[];const check=(ok,name)=>{results.push({ok,name});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);};
(async()=>{
const browser=await chromium.launch({...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),headless:true,args:['--disable-gpu']});
try{
const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await ctx.newPage(),errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
await ctx.setOffline(true);await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>window.PghExamMaker?.ready,{timeout:30000});
check((await page.locator('#bankCount').innerText()).includes('6,700'),'loads embedded bank offline');
await page.screenshot({path:path.join(out,'desktop.png'),fullPage:false});
await page.getByText('Repeat an earlier draw',{exact:true}).click();await page.locator('#seed').fill('20261006');await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
let exam=await page.evaluate(()=>PghExamMaker.exam);check(exam.questions.length===50,'default draw has exactly 50 questions');
check(new Set(exam.questions.map(q=>q.sec)).size===33,'default draw covers all 33 chosen sections');
check(exam.questions.every(q=>!q.isK),'traditional-only filter holds');
check(JSON.stringify(exam.questions.reduce((a,q)=>(a[q.tier]=(a[q.tier]||0)+1,a),{})).length>0,'difficulty data is present');
const tiers=exam.questions.reduce((a,q)=>(a[q.tier]=(a[q.tier]||0)+1,a),{});check(tiers.Easy===10&&tiers.Average===15&&tiers.Difficult===25,'mixed difficulty exact count is 10/15/25');
check(new Set(exam.questions.map(q=>q.id)).size===50,'no repeated question IDs');
fs.writeFileSync(path.join(out,'sample-record.json'),JSON.stringify(exam,null,2));
for(const [button,name] of [['downloadPaper','exam.pdf'],['downloadKey','key.pdf']]){
 const event=page.waitForEvent('download',{timeout:120000});await page.locator('#'+button).click();const download=await event;await download.saveAs(path.join(out,name));check(!await download.failure(),name+' direct download succeeds offline');
 await page.waitForFunction(()=>PghExamMaker.ready);check(fs.statSync(path.join(out,name)).size>10000,name+' contains PDF data');
}
await page.screenshot({path:path.join(out,'generated.png'),fullPage:false});
await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
check(await page.evaluate(code=>PghExamMaker.exam.code===code,exam.code),'same seed and settings reproduce the exam');
await page.locator('#questionCount').fill('40');check(await page.locator('#downloads').isHidden(),'settings change prevents stale PDF downloads');
await page.locator('#selectNone').click();await page.locator('#generate').click();check((await page.locator('#status').innerText()).includes('Select at least'),'empty section selection is rejected');
await page.locator('[data-section="18"]').check();await page.locator('#difficulty').selectOption('Easy');await page.locator('#questionCount').fill('20');await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
exam=await page.evaluate(()=>PghExamMaker.exam);check(exam.questions.every(q=>q.sec===18&&q.tier==='Easy'),'selected section and Easy-only filters hold');
check(exam.questions.every(q=>q.options.every(t=>!/[✓✔✅☑]/.test(t))),'Section 18 options contain no answer marks');
await page.locator('#questionCount').fill('1000');await page.locator('#generate').click();await page.waitForFunction(()=>PghExamMaker.ready);check((await page.locator('#status').innerText()).includes('Reduce the question count'),'insufficient pool is rejected with guidance');check(await page.locator('#downloads').isHidden(),'shortfall produces no partial exam');
await page.locator('#difficulty').selectOption('custom');await page.locator('#mixEasy').fill('80');await page.locator('#generate').click();check((await page.locator('#status').innerText()).includes('add up to 100'),'invalid difficulty mix rejected');
await page.locator('#difficulty').selectOption('Average');await page.locator('#questionCount').fill('8');await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});check(await page.evaluate(()=>PghExamMaker.exam.questions.every(q=>q.tier==='Average')),'Average-only filter holds');
await page.locator('#difficulty').selectOption('Difficult');await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});check(await page.evaluate(()=>PghExamMaker.exam.questions.every(q=>q.tier==='Difficult')),'Difficult-only filter holds');
await page.locator('#selectAll').click();await page.locator('#questionCount').fill('1');await page.locator('#generate').click();check((await page.locator('#status').innerText()).includes('at least 33'),'every selected section must receive a question');
await page.locator('#selectNone').click();await page.locator('[data-section="18"]').check();await page.locator('#difficulty').selectOption('Easy');await page.locator('#questionCount').fill('2');
await page.locator('summary').filter({hasText:'Focus on specific topics'}).click();
const chosen=await page.evaluate(()=>{const counts={};for(const q of PghExamMaker.bank.items)if(q.sec===18&&!q.isK&&q.tier==='Easy'){const k=q.sec+'|'+q.topic;counts[k]=(counts[k]||0)+1;}return Object.keys(counts).find(k=>counts[k]>=3);});
await page.locator('[data-topic]').evaluateAll((nodes,key)=>nodes.find(n=>n.dataset.topic===key).click(),chosen);
await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
check(await page.evaluate(key=>PghExamMaker.exam.questions.every(q=>(q.sec+'|'+q.topic)===key),chosen),'specific topic filter holds');
await page.locator('#rationales').uncheck();await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
const compactEvent=page.waitForEvent('download',{timeout:120000});await page.locator('#downloadKey').click();const compact=await compactEvent;await compact.saveAs(path.join(out,'compact-key.pdf'));await page.waitForFunction(()=>PghExamMaker.ready);check(!await compact.failure(),'compact answer key downloads');
await page.locator('#traditionalOnly').uncheck();await page.locator('#clearTopics').click();await page.locator('#questionCount').fill('20');await page.locator('#difficulty').selectOption('mixed');await page.locator('#generate').click();await page.locator('#downloads').waitFor({state:'visible'});
check(await page.evaluate(()=>PghExamMaker.exam.questions.filter(q=>q.isK).length<=8),'legacy Type K cap holds when enabled');
await page.locator('#questionCount').fill('2.5');await page.locator('#generate').click();check((await page.locator('#status').innerText()).includes('whole number'),'fractional counts rejected');
await page.locator('#questionCount').fill('20');await page.locator('#seed').fill('4294967296');await page.locator('#generate').click();check((await page.locator('#status').innerText()).includes('Seed must'),'invalid seed rejected');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:false});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px mobile layout has no horizontal overflow');
await page.setViewportSize({width:320,height:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px mobile layout has no horizontal overflow');
await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement!==document.body),'keyboard focus reaches interactive controls');
check(errors.length===0,'no browser runtime errors');check(requests.length===0,'zero network requests in offline run');
fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify({results,errors,requests},null,2));
}finally{await browser.close();}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify({results,error:e.message},null,2));process.exitCode=1;});
