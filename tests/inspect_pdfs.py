from pathlib import Path
import json, re, fitz
from PIL import Image, ImageDraw

HERE=Path(__file__).resolve().parent
QA=HERE.parent/'.tmp/regression-qa'
record=json.loads((QA/'sample-record.json').read_text(encoding='utf8'))
results=[]
def check(condition,label):
    results.append({'ok':bool(condition),'name':label})
    if not condition: raise AssertionError(label)
def clean(text):return re.sub(r'\s+',' ',str(text).replace('**','').translate(str.maketrans({'\u2011':'-','\u2013':'-','\u2014':'-','\u2212':'-'}))).strip()
docs={name:fitz.open(QA/(name+'.pdf')) for name in ['exam','key','compact-key']}
for name,d in docs.items():
    check(all(abs(p.rect.width-595.276)<.1 and abs(p.rect.height-841.89)<.1 for p in d),name+' uses A4 pages')
    check(all(f'Page {i+1} of {len(d)}' in p.get_text() for i,p in enumerate(d)),name+' has page numbers on every page')
    check(all('(c) jstiosin 2026' in p.get_text() for p in d),name+' has credit on every page')
    check(all("UP-PGH / DEPARTMENT OF PEDIATRICS" in p.get_text() for p in d),name+' has the institutional header on every page')
    check(all('/jstiosin 2026' not in p.get_text() for p in d),name+' has no old credit format')
    check(all('Jon Bryan S. Tiosin, MD' in p.get_text() for p in d),name+' has full author name on every page')
    violations=[]
    for i,p in enumerate(d):
        for b in p.get_text('dict')['blocks']:
            for ln in b.get('lines',[]):
                for s in ln['spans']:
                    x0,y0,x1,y1=s['bbox']
                    if x0<71 or x1>p.rect.width-71 or y0<27 or y1>813:violations.append((i+1,s['text'],s['bbox']))
    check(not violations,name+' has no text outside page bounds or horizontal margins')
    check(all('Calibri' in f[3] for p in d for f in p.get_fonts()),name+' embeds Calibri fonts')
    check(not d.embfile_names(),name+' has no hidden file attachments')
text={name:clean(' '.join(p.get_text() for p in d)) for name,d in docs.items()}
check('Correct answer:' not in text['exam'] and 'Review: Legacy content' not in text['exam'],'exam contains no key or review disclosures')
check(not re.search('[✓✔✅☑]',text['exam']),'exam contains no answer check marks')
check('Answers, explanations, and sources' not in text['compact-key'],'compact key omits rationales')
for i,q in enumerate(record['questions']):
    check(clean(f'{i+1}. {q["stem"]}') in text['exam'],f'question {i+1} stem matches the draw')
    for option in q['options']:check(clean(option) in text['exam'],f'question {i+1} option survives PDF export')
    keytext=f'Correct answer: {q["key"]}. {q["options"][ord(q["key"])-65]}'
    check(clean(keytext) in text['key'],f'question {i+1} key matches its option')
    check(clean(q['rationale']) in text['key'],f'question {i+1} rationale retained')
    for j,explanation in enumerate(q['expl']):
        if j!=ord(q['key'])-65 and explanation:check(clean(explanation) in text['key'],f'question {i+1} distractor {j+1} retained')
    check(q['id'] in text['key'],f'question {i+1} legacy ID retained')
    for ref in q['refs']:check(clean(ref) in text['key'],f'question {i+1} source reference retained')
check(all(record['code'] in p.get_text() for name in ['exam','key'] for p in docs[name]),'paper and key share an exam code on every page')

# Render every page for visual inspection. Each contact sheet holds at most 12 pages.
for name,d in docs.items():
    thumbs=[]
    for i,p in enumerate(d):
        pix=p.get_pixmap(matrix=fitz.Matrix(1.15,1.15)); png=QA/f'{name}-page-{i+1}.png';pix.save(png)
        image=Image.open(png).convert('RGB');image.thumbnail((298,421))
        thumbs.append(image)
    for offset in range(0,len(thumbs),12):
        batch=thumbs[offset:offset+12];cols=4;rows=(len(batch)+cols-1)//cols
        sheet=Image.new('RGB',(cols*318,rows*455),'#dde3e9');draw=ImageDraw.Draw(sheet)
        for i,im in enumerate(batch):
            x=(i%cols)*318+10;y=(i//cols)*455+24;sheet.paste(im,(x,y));draw.text((x,y-18),f'{name} / page {offset+i+1}',fill='black')
        sheet.save(QA/f'{name}-contact-{offset//12+1}.png')
report={'checks':len(results),'passed':sum(r['ok'] for r in results),'pages':{k:len(v) for k,v in docs.items()},'results':results}
(QA/'pdf-results.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='results'}))
