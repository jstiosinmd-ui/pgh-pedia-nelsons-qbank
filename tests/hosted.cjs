const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const repo=path.resolve(process.argv[2]||path.join(__dirname,'..')),root=path.join(repo,'.tmp/netlify-site'),qa=path.resolve(process.argv[3]||path.join(repo,'.tmp/hosted-qa'));
fs.mkdirSync(qa,{recursive:true});
const types={'.html':'text/html','.json':'application/json','.js':'text/javascript','.png':'image/png','.pdf':'application/pdf'};
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/')name='/index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 if(!fs.existsSync(file)){res.writeHead(404).end();return}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
server.listen(0,'127.0.0.1',()=>{
 const base='http://127.0.0.1:'+server.address().port+'/';
 let test=fs.readFileSync(path.join(repo,'tests/practice.cjs'),'utf8');
 test=test.replace("const url=f=>pathToFileURL(path.join(ROOT,f)).href;",'const url=f=>'+JSON.stringify(base)+'+f;');
 test=test.replace('await context.setOffline(true);','await context.setOffline(false);');
 test=test.replace("if(/^https?:/.test(r.url()))requests.push(r.url())","if(/^https?:/.test(r.url())&&!r.url().startsWith("+JSON.stringify(base)+"))requests.push(r.url())");
 test=test.replaceAll("()=>PracticeBank.bankKind===", "()=>globalThis.PracticeBank?.bankKind===");
 const testFile=path.join(qa,'practice-http.cjs');fs.writeFileSync(testFile,test);
 const child=cp.spawn(process.execPath,[testFile,root],{stdio:'inherit',env:{...process.env,QA_DIR:qa}});
 child.on('exit',async code=>{
  if(code){server.close();process.exitCode=code;return}
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH});
  const checks=[];const check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name)};
  try{
   const page=await browser.newPage();
   await page.goto(base+'boards-mock.html');await page.waitForFunction(()=>!!globalThis.MockBank);
   check(await page.evaluate(()=>MockBank.items.length===1000),'Hosted board review loads all 1000 questions');
   check(await page.locator('#deliveryStatus').count()===0,'Board review loading panel clears');
   const html=fs.readFileSync(path.join(root,'question-bank.html'),'utf8');
   const plan=JSON.parse(html.match(/<script id="deliveryPlan"[^>]*>([\s\S]*?)<\/script>/)[1]);
   const first=plan.blocks.find(b=>b.bank==='mock').parts[0];
   let attempts=0;
   await page.route(base+first,route=>++attempts<3?route.fulfill({status:503,body:'temporary failure'}):route.continue());
   const loaded=[];page.on('request',r=>loaded.push(r.url()));
   await page.goto(base+'question-bank.html?bank=mock');await page.waitForFunction(()=>!!globalThis.PracticeBank);
   check(attempts===3,'Temporary data failures retry successfully');
   check(!plan.blocks.find(b=>b.bank==='nelson').parts.some(part=>loaded.includes(base+part)),'Board practice downloads only the selected bank');
   await page.unroute(base+first);
   await page.route(base+first,route=>route.fulfill({contentType:'application/json',body:JSON.stringify('corrupted data')}));
   await page.reload();await page.locator('#deliveryRetry').waitFor({state:'visible'});
   check(await page.evaluate(()=>!globalThis.PracticeBank),'Corrupted data cannot start practice');
   check((await page.locator('#deliveryMessage').innerText()).includes('could not finish loading'),'Integrity failure displays a recovery message');
   await page.unroute(base+first);
   await page.locator('#deliveryRetry').click();await page.waitForFunction(()=>!!globalThis.PracticeBank);
   check(await page.locator('#bankCount').innerText()==='1,000','Retry restores all questions after integrity failure');
   await page.route(base+first,route=>route.fulfill({status:503,body:'unavailable'}));
   await page.reload();await page.locator('#deliveryRetry').waitFor({state:'visible'});
   check(await page.evaluate(()=>!globalThis.PracticeBank),'Persistent download failure cannot start partial practice');
   await page.unroute(base+first);
   await page.route(base+plan.scripts[0].parts[0],route=>route.fulfill({contentType:'application/json',body:JSON.stringify('corrupted script')}));
   await page.reload();await page.locator('#deliveryRetry').waitFor({state:'visible'});
   check(await page.evaluate(()=>!globalThis.PracticeBank),'Corrupted runtime cannot execute');
   const referenced=[...plan.blocks,...plan.scripts].flatMap(b=>b.parts);
   check(referenced.every(part=>fs.statSync(path.join(root,part)).size<160000),'All practice data and script pieces remain below 160 KB');
   console.log(JSON.stringify({hosting_checks:checks.length}));
  }catch(error){console.error(error);process.exitCode=1}
  finally{fs.writeFileSync(path.join(qa,'hosting-checks.json'),JSON.stringify({checks},null,2));await browser.close();server.close()}
 });
});
