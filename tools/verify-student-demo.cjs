const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.CINEMA_WEB_URL||'http://127.0.0.1:8080';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Only run on the local academic demo.');
(async()=>{
  const out=path.resolve(__dirname,'../docs/qa-student/evidence');
  await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({channel:process.env.CINEMA_BROWSER||'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[],tests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/admin\/tests\//.test(r.url())&&r.method()==='POST')tests.push(r.url());});
  try{
    await page.goto(base+'/?demo=1',{waitUntil:'networkidle'});
    const dialog=page.getByRole('dialog');
    await dialog.waitFor();
    await page.locator('.academic-demo-quick-grid article').first().waitFor();
    const desktopColumns=await page.locator('.movie-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length);
    assert.equal(desktopColumns,4,'Desktop catalog must use four bounded columns.');
    assert.equal(await page.locator('.academic-demo-steps>li').count(),5);
    assert.equal(await page.locator('.academic-demo-quick-grid article').count(),3);
    await page.screenshot({path:path.join(out,'student-guide-desktop.png')});
    await dialog.evaluate(e=>{e.scrollTop=e.scrollHeight;});
    await page.getByRole('button',{name:'Mở Lab Oracle',exact:true}).waitFor({state:'visible'});
    await page.screenshot({path:path.join(out,'student-guide-steps.png')});
    await dialog.evaluate(e=>{e.scrollTop=0;});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const mobileColumns=await page.locator('.movie-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length);
    assert.equal(mobileColumns,2,'Mobile catalog must use two bounded columns.');
    await page.screenshot({path:path.join(out,'student-guide-mobile.png')});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Hướng dẫn demo',exact:true}).click();
    await dialog.waitFor();
    const fallback=page.getByRole('button',{name:'Kiểm thử QR ngay trong Lab (TC-09)',exact:true});
    let fallbackChecked=false;
    if(await fallback.count()){
      await fallback.click();await dialog.waitFor({state:'hidden'});
      await page.getByRole('heading',{name:'Phòng Thí Nghiệm Kiểm Thử Ràng Buộc & PL/SQL',exact:true}).waitFor();
      fallbackChecked=true;
    }
    assert.equal(tests.length,0,'Opening a guide must never automatically execute lab tests.');
    assert.deepEqual(errors,[]);
    const result={passed:true,steps:5,scenarios:3,scrollToLastStep:true,desktopCatalogColumns:desktopColumns,mobileCatalogColumns:mobileColumns,mobileWidth:390,escapeAndReopen:true,qrFallbackChecked:fallbackChecked,autoExecutedTests:0,pageErrors:errors};
    await fs.writeFile(path.resolve(out,'../student-guide-results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
