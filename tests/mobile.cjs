// Run with Node.js and Playwright. PLAYWRIGHT_MODULE and BROWSER_PATH are optional local overrides.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'.tmp','mobile-qa');
fs.mkdirSync(OUT,{recursive:true});
const checks=[];
function check(ok,name){checks.push({ok,name});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name);}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,acceptDownloads:true,reducedMotion:'reduce'});
  await context.setOffline(true);const page=await context.newPage();const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(path.join(ROOT,'exam-maker.html')).href);await page.waitForFunction(()=>globalThis.PghExamMaker?.ready);
  check(await page.locator('#mobileGenerate').count()===1,'mobile action button exists');
  check(await page.locator('#mobileGenerate').isVisible(),'mobile action button is visible at page start');
  check(await page.locator('#difficulty').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'mobile form uses readable 16px text');
  for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[768,1024],[932,430]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.activeElement.blur());
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px layout has no horizontal overflow`);
   check(await page.locator('#mobileGenerate').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44;}),`${width}px fixed action is visible and touch sized`);
   check(await page.locator('#difficulty').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>240&&r.height>=48;}),`${width}px difficulty selector has a full readable row`);
   check(await page.locator('#selectAll').evaluate(e=>e.getBoundingClientRect().height>=44),`${width}px section toolbar has touch sized controls`);
   await page.screenshot({path:path.join(OUT,`phone-${width}.png`)});
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#questionCount').tap();check(await page.locator('#mobileGenerate').isHidden(),'action bar hides during numeric entry');
  await page.locator('#questionCount').fill('20');await page.locator('#questionCount').blur();
  await page.waitForFunction(()=>!document.body.classList.contains('editing-field'));
  check(await page.locator('#mobileGenerate').isVisible(),'action bar returns after text entry');
  await page.locator('#mobileGenerate').tap();await page.waitForFunction(()=>PghExamMaker.ready);
  check((await page.locator('#status').innerText()).includes('at least 33'),'invalid count surfaces the topic coverage error');
  check(await page.locator('#resultsTitle').evaluate(e=>e.getBoundingClientRect().top>=0&&e.getBoundingClientRect().top<innerHeight),'error result is brought into view');
  await page.locator('#questionCount').fill('50');await page.locator('#questionCount').blur();
  await page.waitForFunction(()=>!document.body.classList.contains('editing-field'));
  await page.locator('#mobileGenerate').tap();await page.locator('#downloads').waitFor({state:'visible'});await page.waitForFunction(()=>PghExamMaker.ready);
  check((await page.locator('#mobileGenerate').innerText())==='View PDFs','action bar switches to PDF navigation');
  check(await page.locator('#previewList .preview-item').count()===5,'only five preview questions render at a time');
  check((await page.locator('#previewPage').innerText())==='Questions 1–5 of 50','preview range starts at the first five questions');
  const code=await page.evaluate(()=>PghExamMaker.exam.code);
  await page.locator('#previewNext').tap();
  check((await page.locator('#previewPage').innerText())==='Questions 6–10 of 50','preview next page advances question numbering');
  await page.locator('#previewPrev').tap();
  check((await page.locator('#previewPage').innerText())==='Questions 1–5 of 50','preview previous page restores the first range');
  check(await page.evaluate(c=>PghExamMaker.exam.code===c,code),'preview navigation does not redraw the exam');
  await page.locator('#previewList summary').first().tap();check(await page.locator('#previewList details').first().getAttribute('open')!==null,'answer rationale expands by touch');
  await page.locator('#mobileGenerate').tap();
  check(await page.locator('#resultsTitle').evaluate(e=>e.getBoundingClientRect().top>=0&&e.getBoundingClientRect().top<innerHeight),'View PDFs brings downloads into view');
  await page.screenshot({path:path.join(OUT,'phone-result.png')});
  for(const [button,link,name] of [['downloadPaper','paperLink','mobile-exam.pdf'],['downloadKey','keyLink','mobile-key.pdf']]){
   check((await page.locator('#'+button).innerText()).startsWith('Prepare'),'mobile PDF action clearly says Prepare');
   await page.locator('#'+button).tap();await page.locator('#'+link).waitFor({state:'visible',timeout:120000});await page.waitForFunction(()=>PghExamMaker.ready);
   check(await page.locator('#'+link).evaluate(e=>e.href.startsWith('blob:')&&e.download.endsWith('.pdf')),'ready PDF has a persistent download link');
   const event=page.waitForEvent('download',{timeout:30000});await page.locator('#'+link).tap();const dl=await event;await dl.saveAs(path.join(OUT,name));
   check(!await dl.failure()&&fs.statSync(path.join(OUT,name)).size>10000,name+' saves after an explicit user tap offline');
  }
  await page.screenshot({path:path.join(OUT,'phone-pdfs.png')});
  await page.locator('#previewNext').tap();
  check(await page.locator('#paperLink').isVisible(),'ready PDF remains available during preview navigation');
  await page.locator('#questionCount').fill('40');await page.locator('#questionCount').blur();
  check(await page.locator('#downloads').isHidden(),'changing settings hides old downloads');
  check(await page.locator('#paperLink').getAttribute('href')===null&&await page.locator('#keyLink').getAttribute('href')===null,'changing settings removes stale PDF targets');
  check((await page.locator('#mobileGenerate').innerText())==='Generate exam','changing settings restores the Generate action');
  await page.getByText('Topics',{exact:true}).tap();await page.locator('#selectNone').tap();await page.locator('#sectionSearch').fill('respiratory');await page.locator('#sectionSearch').blur();
  await page.locator('[data-section="18"]').tap();check((await page.locator('#selectionSummary').innerText()).startsWith('1 sections'),'subject selection works through mobile search');
  await page.getByText('Focus on specific topics within these sections',{exact:true}).tap();await page.locator('#topicSearch').fill('pharyngitis');await page.locator('#topicSearch').blur();
  check(await page.locator('[data-topic]').count()>0,'specific-topic search works by touch');
  await page.locator('[data-topic]').first().tap();check((await page.locator('#topicSelection').innerText()).includes('1 specific'),'specific topic selection updates the scope');
  await page.locator('#clearTopics').tap();await page.locator('#sectionSearch').fill('');await page.locator('#sectionSearch').blur();await page.locator('#selectAll').tap();
  await page.locator('#questionCount').fill('33');await page.locator('#questionCount').blur();await page.waitForFunction(()=>!document.body.classList.contains('editing-field'));
  await page.locator('#mobileGenerate').tap();await page.locator('#downloads').waitFor({state:'visible'});
  for(let i=0;i<6;i++)await page.locator('#previewNext').tap();
  check(await page.locator('#previewList .preview-item').count()===3&&(await page.locator('#previewPage').innerText())==='Questions 31–33 of 33','last preview page handles a partial set');
  check(await page.locator('#previewNext').isDisabled(),'next is disabled on the final preview page');
  await page.evaluate(()=>document.querySelector('.footer').scrollIntoView({block:'end'}));
  check(await page.locator('.footer').evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('.mobile-bar').getBoundingClientRect().top),'bottom action bar does not cover footer content');
  // A separate desktop context checks the unchanged wide-screen layout and downloads.
  const desktopContext=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});await desktopContext.setOffline(true);
  const desktop=await desktopContext.newPage();desktop.on('pageerror',e=>errors.push(e.message));
  await desktop.goto(pathToFileURL(path.join(ROOT,'exam-maker.html')).href);await desktop.waitForFunction(()=>PghExamMaker.ready);
  check(await desktop.locator('#mobileGenerate').isHidden(),'mobile bar stays hidden on desktop');
  check(await desktop.locator('.layout').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===2),'desktop retains its two-column layout');
  await desktop.locator('#generate').click();await desktop.locator('#downloads').waitFor({state:'visible'});
  const desktopEvent=desktop.waitForEvent('download',{timeout:120000});await desktop.locator('#downloadPaper').click();const desktopDl=await desktopEvent;await desktopDl.saveAs(path.join(OUT,'desktop-exam.pdf'));
  check(!await desktopDl.failure(),'desktop still downloads directly in one click');
  await desktop.screenshot({path:path.join(OUT,'desktop-result.png')});
  check(errors.length===0,'no browser runtime errors');check(requests.length===0,'no network requests in the offline mobile workflow');
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,errors,requests},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,error:e.message},null,2));process.exitCode=1;});
