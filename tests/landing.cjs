const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),edition=JSON.parse(fs.readFileSync(path.join(__dirname,'edition.json'),'utf8'));
const OUT=path.join(ROOT,'.tmp','landing-qa'),SHOTS=path.join(ROOT,'screenshots');
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(SHOTS,{recursive:true});
const checks=[];function check(ok,name){checks.push({ok,name});if(!ok)throw Error(name);}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await context.setOffline(true);
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(path.join(ROOT,'index.html')).href);
  check((await page.title())===edition.platform,'landing uses platform name');
  check(await page.locator('.logo-frame img').evaluate(e=>e.complete&&e.naturalWidth>0&&e.src.startsWith('data:')),'hospital logo is embedded and loaded');
  check((await page.locator('.hospital').innerText()).includes(edition.hospital),'correct hospital on landing');
  check((await page.locator('footer').innerText()).includes('(c) jstiosin 2026'),'landing copyright credit');
  check((await page.locator('footer').innerText()).includes('Jon Bryan S. Tiosin, MD'),'landing full author name');
  check(await page.locator('a[href="question-bank.html"]').count()===(edition.study?1:0),'correct question-bank availability');
  for(const width of [320,360,390,430,768,932,1280]){
   await page.setViewportSize({width,height:900});
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px landing has no horizontal overflow`);
   check(await page.locator('.maker-card').evaluate(e=>e.getBoundingClientRect().height>=44),`${width}px primary entry is touch sized`);
  }
  await page.setViewportSize({width:1280,height:900});await page.screenshot({path:path.join(SHOTS,'landing-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(SHOTS,'landing-mobile.png'),fullPage:true});
  await page.locator('a[href="exam-maker.html"]').click();await page.waitForFunction(ns=>globalThis[ns+'ExamMaker']?.ready,edition.namespace);
  check((await page.title()).includes(edition.platform),'exam maker has platform name');
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px maker has no horizontal overflow`);
  }
  check((await page.locator('footer').innerText()).includes('(c) jstiosin 2026'),'exam maker copyright credit');
  check((await page.locator('footer').innerText()).includes('Jon Bryan S. Tiosin, MD'),'exam maker full author name');
  await page.locator('.home-link').click();check((await page.title())===edition.platform,'exam maker returns to landing');
  if(edition.study){
   await page.locator('a[href="question-bank.html"]').click();await page.locator('.exam-card').first().waitFor();
   check((await page.title()).includes(edition.platform),'question bank has platform name');
   check((await page.locator('footer').innerText()).includes('(c) jstiosin 2026'),'question-bank copyright credit');
   check((await page.locator('footer').innerText()).includes('Jon Bryan S. Tiosin, MD'),'question-bank full author name');
   await page.locator('[data-section="18"]').click();
   check((await page.locator('footer').innerText()).includes('Jon Bryan S. Tiosin, MD'),'author persists during section practice');
   await page.locator('.home-link').click();check((await page.title())===edition.platform,'question bank returns to landing');
  }
  check(errors.length===0,'no browser runtime errors');check(requests.length===0,'no network requests');
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,errors,requests},null,2));console.log(JSON.stringify({edition:edition.key,checks:checks.length,passed:checks.filter(c=>c.ok).length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,error:e.message},null,2));process.exitCode=1;});
