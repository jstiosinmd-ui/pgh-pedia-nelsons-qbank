const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const ROOT=path.resolve(process.argv[2]||path.join(__dirname,'..')),OUT=path.resolve(process.env.QA_DIR||path.join(ROOT,'.tmp','practice-qa'));
fs.mkdirSync(OUT,{recursive:true});const checks=[],errors=[],requests=[];
function check(ok,name){checks.push({ok:!!ok,name});if(!ok)throw Error(name)}
const url=f=>pathToFileURL(path.join(ROOT,f)).href;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--allow-file-access-from-files'],downloadsPath:path.join(OUT,'downloads')});let p;
try{const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});await context.setOffline(true);p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 async function backup(name){const wait=p.waitForEvent('download');await p.locator('#exportProgress').click();const file=path.join(OUT,name);await(await wait).saveAs(file);return file}
 async function importFile(file){await p.locator('#progressFile').setInputFiles(file);await p.locator('#confirmImport').click()}
 let legacyBackup=null;
 if(process.env.LEGACY_STUDY_PATH){await p.goto(pathToFileURL(process.env.LEGACY_STUDY_PATH).href);await p.locator('[data-section="8"]').click();await p.locator('input[name=answer][value=A]').check();await p.locator('#flagBtn').click();legacyBackup=await backup('legacy-nelson.json')}
 await p.goto(url('index.html'));check(await p.getByRole('heading',{name:'Practice questions',exact:true}).count()===1,'Home has one practice entry');await p.locator('a[href="question-bank.html"]').click();await p.waitForFunction(()=>!!globalThis.PracticeBank);
 const config=await p.evaluate(()=>PracticeBank.config);check(await p.locator('.brand img').evaluate(e=>e.complete&&e.naturalWidth>0),'Institution logo loads');check((await p.locator('.studio-title').innerText()).includes(config.shortName),'Institution branding');
 check(await p.locator('#bankSource option').count()===2,'Two source choices');check(await p.locator('#bankSource').inputValue()==='nelson','Default Nelson source');
 if(legacyBackup){await importFile(legacyBackup);check(await p.evaluate(()=>PracticeBank.current===8&&PracticeBank.sessions[8].answers[0]==='A'&&PracticeBank.sessions[8].flags.includes(0)),'Existing Nelson backup imports without losing answers or flags');await p.locator('#backLibrary').click()}
 const storageKeys=[];
 for(const bank of ['nelson','mock']){
  if(bank==='mock'){await p.locator('#bankSource').selectOption(bank);await p.waitForURL('**?bank=mock');await p.waitForFunction(()=>PracticeBank.bankKind==='mock')}
  check(await p.locator('.exam-card').count()===(bank==='mock'?10:33),bank+' section/set count');
  check((await p.locator('#bankCount').innerText())===(bank==='mock'?'1,000':'6,700'),bank+' question count');
  storageKeys.push(await p.evaluate(()=>PracticeBank.storageKey));
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),bank+' library no overflow '+width)}
  await p.setViewportSize({width:1440,height:1000});
  if(bank==='mock'){
   check(await p.locator('#pendingSection').isHidden(),'Nelson pending-section notice hidden for boards');
   check(await p.evaluate(()=>{const source=JSON.parse(document.getElementById('mockBankData').textContent);const qs=PracticeBank.bank.flatMap(s=>s.items);return qs.length===1000&&qs.every(q=>{const o=source.items.find(x=>x.id===q.id);return o&&o.stem===q.stem&&o.key===q.correct&&o.rationale===q.rationale&&o.tier===q.tier&&JSON.stringify(o.options)===JSON.stringify(q.options.map(x=>x.text))&&q.options.every(x=>x.correct===(x.letter===q.correct));})}),'All 1000 adapted board questions preserve wording, options, keys, rationales, and difficulty');
  }
  await p.locator('#searchInput').fill(bank==='mock'?'set 10':'The Field of Pediatrics');check(await p.locator('.exam-card').count()===1,bank+' library search');await p.locator('#searchInput').fill('');
  await p.locator('[data-section="1"]').click();const first=await p.evaluate(()=>PracticeBank.bank[0].items[0]);
  check(await p.locator('#timerState').innerText()==='Ready',bank+' timer starts ready');check(await p.locator('.rationale').count()===0,bank+' answers hidden before scoring');
  await p.locator('input[name=answer][value='+first.correct+']').check();check(await p.locator('#timerState').innerText()==='Running',bank+' timer starts on first answer');
  await p.locator('#flagBtn').click();check(await p.locator('#flagBtn').getAttribute('aria-pressed')==='true',bank+' flag saved');
  await p.locator('#nextBtn').click();const second=await p.evaluate(()=>PracticeBank.bank[0].items[1]);await p.locator('input[name=answer][value='+('ABCD'.split('').find(l=>l!==second.correct))+']').check();
  await p.locator('#mapNext').click();check((await p.locator('#mapPosition').innerText()).includes('Page 2'),bank+' question map paging');
  await p.locator('#jumpNumber').fill('1');await p.locator('#jumpForm button').click();check(await p.locator('input[name=answer]:checked').inputValue()===first.correct,bank+' jump preserves answer');
  await p.reload();check(await p.locator('input[name=answer]:checked').inputValue()===first.correct,bank+' answer restored on reload');check(await p.locator('#flagBtn').getAttribute('aria-pressed')==='true',bank+' flag restored on reload');
  await p.locator('#submitBtn').click();await p.locator('#cancelSubmit').click();check(await p.locator('.rationale').count()===0,bank+' cancel scoring keeps attempt open');
  await p.locator('#submitBtn').click();await p.locator('#confirmSubmit').click();check((await p.locator('#results .score').innerText()).replace(/\s/g,'')==='1/'+(bank==='mock'?100:200),bank+' exact score');check(await p.locator('input[name=answer]:disabled').count()===4,bank+' graded answer locking');
  check((await p.locator('.rationale').innerText()).replace(/\s+/g,' ').includes(first.rationale.replace(/\*\*/g,'').replace(/\s+/g,' ')),bank+' rationale visible');
  await p.locator('#reviewSelect').selectOption('incorrect');check(await p.locator('#reviewCount').innerText()==='1 question',bank+' incorrect review filter');
  await p.locator('#reviewSelect').selectOption('unanswered');check((await p.locator('#reviewCount').innerText()).startsWith(bank==='mock'?'98 ':'198 '),bank+' unanswered review filter');
  await p.locator('#reviewSelect').selectOption('flagged');check(await p.locator('#reviewCount').innerText()==='1 question',bank+' flagged review filter');await p.locator('#reviewSelect').selectOption('all');
  await p.keyboard.press('Tab');check(await p.evaluate(()=>document.activeElement!==document.body),bank+' keyboard focus');
  for(const width of [390,320]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),bank+' graded question no overflow '+width)}
  await p.screenshot({path:path.join(OUT,bank+'-question-mobile.png')});await p.setViewportSize({width:1440,height:1000});
  const file=await backup(bank+'-backup.json');await p.locator('#retakeBtn').click();await p.locator('#confirmRestart').click();check(await p.locator('#answeredCount').innerText()==='0 / '+(bank==='mock'?100:200),bank+' restart clears only this attempt');
  await importFile(file);check((await p.locator('#results .score').innerText()).replace(/\s/g,'')==='1/'+(bank==='mock'?100:200),bank+' backup restores result');
  await p.emulateMedia({media:'print'});check(await p.locator('.source-picker').isHidden()&&await p.locator('.nav-panel').isHidden(),bank+' print hides controls');await p.emulateMedia({media:'screen'});
  await p.locator('#backLibrary').click();await p.screenshot({path:path.join(OUT,bank+'-library-desktop.png')});
 }
 check(storageKeys[0]!==storageKeys[1],'Bank-specific storage namespaces');
 await p.locator('#bankSource').selectOption('nelson');await p.waitForURL('**?bank=nelson');await p.waitForFunction(()=>PracticeBank.bankKind==='nelson');
 check(await p.evaluate(()=>PracticeBank.sessions[1].graded&&Object.keys(PracticeBank.sessions[1].answers).length===2),'Switching banks retains Nelson attempt');
 await p.locator('#progressFile').setInputFiles(path.join(OUT,'mock-backup.json'));await p.waitForFunction(()=>document.getElementById('noticeText').textContent.includes('does not match'));check((await p.locator('#noticeText').innerText()).includes('does not match'),'Wrong-bank backup rejected');check(await p.evaluate(()=>PracticeBank.sessions[1].graded),'Wrong-bank import leaves saved attempt intact');
 await p.locator('#bankSource').selectOption('mock');await p.waitForURL('**?bank=mock');await p.waitForFunction(()=>PracticeBank.bankKind==='mock');
 const wrongInstitution=JSON.parse(fs.readFileSync(path.join(OUT,'mock-backup.json')));wrongInstitution.brand='unrelated-institution';const wrongFile=path.join(OUT,'wrong-institution.json');fs.writeFileSync(wrongFile,JSON.stringify(wrongInstitution));await p.locator('#progressFile').setInputFiles(wrongFile);await p.waitForFunction(()=>document.getElementById('noticeText').textContent.includes('does not match'));check((await p.locator('#noticeText').innerText()).includes('does not match'),'Wrong-institution backup rejected');
 const expiry=JSON.parse(fs.readFileSync(path.join(OUT,'mock-backup.json')));expiry.sessions[1].graded=false;expiry.sessions[1].deadline=Date.now()-5000;expiry.sessions[1].remaining=1;const expFile=path.join(OUT,'expired.json');fs.writeFileSync(expFile,JSON.stringify(expiry));await importFile(expFile);check((await p.locator('#results').innerText()).includes('Time completed'),'Expired deadline grades on restore');
 await p.locator('#backLibrary').click();await p.locator('[data-section="7"]').click();await p.locator('#jumpNumber').fill('93');await p.locator('#jumpForm button').click();const repaired=await p.evaluate(()=>PracticeBank.bank[6].items[92]);await p.locator('input[name=answer][value='+repaired.correct+']').check();await p.locator('#submitBtn').click();await p.locator('#confirmSubmit').click();
 check((await p.locator('.rationale').innerText()).includes('Revised and source reviewed'),'Repaired question review status');check(await p.locator('.rationale li').count()===3,'Repaired question has three distractor explanations');check(await p.locator('.reference a').count()>0,'Repaired source has a clickable reference');
 await p.locator('#bankSource').selectOption('nelson');await p.waitForURL('**?bank=nelson');await p.waitForFunction(()=>PracticeBank.bankKind==='nelson');check(await p.evaluate(()=>PracticeBank.sessions[7]===undefined),'Board set progress does not leak into Nelson sections');
 if(process.env.FULL_SCORE_TEST==='1'){
  await p.locator('#bankSource').selectOption('mock');await p.waitForURL('**?bank=mock');await p.locator('#backLibrary').click();await p.locator('[data-section="2"]').click();const answers=await p.evaluate(()=>PracticeBank.bank[1].items.map(q=>q.correct));for(let i=0;i<answers.length;i++){await p.locator('input[name=answer][value='+answers[i]+']').check();if(i<answers.length-1)await p.locator('#nextBtn').click()}
  await p.locator('#submitBtn').click();await p.locator('#confirmSubmit').click();check((await p.locator('#results .score').innerText()).replace(/\s/g,'')==='100/100','Full board set scores exactly 100/100');
 }
 for(const bank of ['nelson','mock']){
  await p.goto(url('exam-maker.html')+'?bank='+bank);await p.waitForFunction(()=>Object.keys(window).some(k=>k.endsWith('ExamMaker')&&window[k]?.ready));
  check((await p.locator('#practiceLink').getAttribute('href'))==='question-bank.html?bank='+bank,bank+' maker practice link preserves bank');
  await p.locator('#generate').click();await p.waitForFunction(()=>Object.keys(window).some(k=>k.endsWith('ExamMaker')&&window[k]?.exam));check(await p.evaluate(()=>Object.keys(window).filter(k=>k.endsWith('ExamMaker')).some(k=>window[k].exam.questions.length===50)),bank+' exam generation retained');
  await p.locator('#practiceLink').click();await p.waitForURL('**/question-bank.html?bank='+bank);await p.waitForFunction(b=>globalThis.PracticeBank?.bankKind===b,bank);check(await p.locator('#bankSource').inputValue()===bank,bank+' maker-to-practice navigation');
 }
 check(errors.length===0,'No JavaScript runtime errors: '+errors.join('; '));check(requests.length===0,'No network requests');
 console.log(JSON.stringify({institution:config.shortName,passed:checks.length}));
}catch(e){if(p)await p.screenshot({path:path.join(OUT,'failure.png')}).catch(()=>{});throw e}
finally{fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify({checks,errors,requests},null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
