"""Playwright acceptance suite. Set CHROMIUM_BIN for an installed browser."""
import os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

def run(browser, size, language, url, transcript=False):
    mobile=size['width']<=400
    ctx=browser.new_context(viewport=size, reduced_motion='reduce',is_mobile=mobile,has_touch=mobile,device_scale_factor=2 if mobile else 1)
    page=ctx.new_page()
    errors=[]; net=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:net.append(r.url))
    page.goto(url)
    def click(action, val=None):
        q=f'[data-do="{action}"]'+(f'[data-val="{val}"]' if val is not None else '')
        control=page.locator(q).first
        if mobile:control.tap()
        else:control.click()
    def tune(k,keypad=False):
        if keypad:
            for n in k:click('digit',n)
        else:page.keyboard.type(k)
    def width(): assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    def progress(n): expect(page.locator('#progress')).to_contain_text(f'{n}/3')
    expect(page.locator('#pg')).to_have_text('P100'); width()
    click('lang',language)
    tune('793');expect(page.locator('#pg')).to_have_text('P100')
    click('begin');expect(page.locator('#pg')).to_have_text('P214')
    click('physicalMode','tape')
    old=page.locator('.clueRows').inner_text()
    click('mode','diff');click('isolate','0');progress(0)
    click('isolate','1');progress(1)
    click('journal');tune('326');expect(page.locator('#pg')).to_have_text('P214')
    page.keyboard.press('Escape')
    page.reload();progress(1)
    tune('326',True);width()
    expect(page.locator('#film')).to_be_visible()
    assert page.locator('#film').evaluate('v=>v.paused&&!v.autoplay&&v.muted')
    click('capture','1');progress(1)
    if transcript:click('transcript')
    else:page.wait_for_function("document.querySelector('video').readyState>=2")
    page.locator('#tapeSeek').evaluate("(el,t)=>{el.value=t;el.dispatchEvent(new Event('input',{bubbles:true}))}","6.2")
    page.reload();expect(page.locator('#tapeClock')).to_have_text('6.2s')
    if not transcript:page.wait_for_function("(()=>{let v=document.querySelector('video');return v.paused&&!v.seeking&&v.currentTime>=6.15})()")
    else:
        expect(page.locator('#staticTranscript')).to_be_visible()
        expect(page.locator('#transcriptLine')).to_contain_text('blinks twice' if language=='en' else 'dvakrát blikne')
    click('capture','0');progress(1)
    click('capture','1');progress(2)
    tune('418',True);width();click('align');progress(2)
    click('layer','chart');click('layer','lights');click('layer','both')
    if transcript:
        click('mapMove','rotate');click('mapMove','left');click('mapMove','down')
    else:
        for k in ['r','ArrowLeft','ArrowDown']:page.keyboard.press(k)
    expect(page.locator('.mapState')).to_have_text('90° / X-1 / Y+1')
    page.reload();expect(page.locator('.mapState')).to_have_text('90° / X-1 / Y+1')
    click('align');progress(3);tune('500')
    expect(page.locator('.evidence')).to_have_count(3)
    tune('739');expect(page.locator('#pg')).to_have_text('P500')
    tune('793',True);click('report','0');expect(page.locator('.answers')).to_be_visible()
    click('report','1');width()
    expect(page.locator('.parityCode')).to_have_count(6)
    expect(page.locator('[data-do=publish]')).to_have_count(0)
    if mobile:
        assert page.locator('[data-do=pickSlot]').first.bounding_box()['height']>=44
    click('pickSlot','C');click('pickSlot','B')
    expect(page.locator('#notice')).to_contain_text('order' if language=='en' else 'Pořadí')
    click('pickSlot','B');page.reload()
    expect(page.locator('.slotBox').first).to_have_text('Slot 1: B')
    click('pickSlot','C');click('pickChannel','SR-2')
    expect(page.locator('[data-do=publish]')).to_have_count(0)
    click('pickChannel','EO-7');expect(page.locator('[data-do=publish]')).to_be_visible()
    click('redraft');click('report','1')
    expect(page.locator('[data-do=publish]')).to_have_count(0)
    click('pickSlot','B');click('pickSlot','C');click('pickChannel','EO-7')
    page.reload();click('publish')
    expect(page.locator('h1')).to_have_text('All aboard' if language=='en' else 'Všichni na palubě')
    page.reload();tune('214')
    expect(page.locator('.clueRows')).to_contain_text('CORRECTION' if language=='en' else 'OPRAVA')
    click('physicalMode','tape');assert page.locator('.clueRows').inner_text()==old
    click('reset');click('close');progress(3)
    click('reset');click('confirmReset');progress(0)
    expect(page.locator('#pg')).to_have_text('P100');width()
    assert not errors,errors
    if url.startswith('file:'):assert not any(re.match(r'https?://',x) for x in net),net
    print('PASS',size,language,'transcript' if transcript else 'actual video')
    ctx.close()
def run_editions(browser, url):
    ctx=browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce',is_mobile=True,has_touch=True,device_scale_factor=2)
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url)
    def click(a,v=None):
        f=f'[data-do="{a}"]'+(f'[data-val="{v}"]' if v is not None else '')
        page.locator(f).first.tap()
    def width():assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    def index():page.locator('#home').tap()
    def progress(n):expect(page.locator('.casePhase')).to_contain_text(f'{n}/2')
    expect(page.locator('.caseCard')).to_have_count(4);width()
    page.locator('.caseCard[data-val="611"]').tap();width()
    click('physicalMode','tape');original=page.locator('.stationLine.original').inner_text()
    click('trainPick','r9');progress(0)
    click('trainPick','r8')
    for stop in ['cut','depot','shelter']:click('trainRoute',stop)
    click('trainLock');progress(2)
    click('mode','live');expect(page.locator('.stationLine')).to_contain_text('R2 departed empty')
    click('editionPublish')
    expect(page.locator('.stationLine.corrected')).to_contain_text('R8 diverted east')
    click('physicalMode','tape');assert page.locator('.stationLine.original').inner_text()==original
    index();page.locator('.caseCard[data-val="672"]').tap();width()
    click('lang','cs')
    click('vane','-1');page.keyboard.press('ArrowLeft');click('vaneLock')
    click('safety','site-east');click('safety','until-0020');click('safetyLock')
    expect(page.locator('.stationLine.corrected')).to_have_count(0)
    index();page.locator('.caseCard[data-val="747"]').tap();width()
    click('flashDecode','L');progress(0)
    for k in range(3):click('frame','1')
    click('flashDecode','L')
    for k in 'LSL':click('flashPulse',k)
    click('flashLock');click('editionPublish')
    expect(page.locator('.stationLine.corrected')).to_contain_text('Odesláno K')
    page.reload()
    click('reset');click('confirmReset');progress(0)
    index();page.locator('.caseCard[data-val="672"]').tap()
    expect(page.locator('[data-do=editionPublish]')).to_be_visible()
    click('editionPublish');expect(page.locator('.stationLine.corrected')).to_contain_text('Východní most')
    index();page.locator('.caseCard[data-val="611"]').tap()
    expect(page.locator('.stationLine.corrected')).to_contain_text('R8 odkloněn')
    assert not errors,errors
    print('PASS: 390px case library, all three new cases, Czech content, independent reset/reload')
    ctx.close()

if __name__=='__main__':
    url=sys.argv[1] if len(sys.argv)>1 else (Path(__file__).resolve().parents[1]/'index.html').as_uri()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_BIN') or None)
        for size,lang,transcript in [({'width':1280,'height':800},'en',False),({'width':390,'height':844},'cs',False),({'width':320,'height':780},'en',True)]:
            run(browser,size,lang,url,transcript)
        run_editions(browser,url)
        browser.close()
