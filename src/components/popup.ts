import { createElement } from '../includes/utils'


function onClickEvent (e: MouseEvent) {
  const target = e.target as HTMLAnchorElement;
  if (target.href) {
    if (!target.querySelector('a > em.icon_img')) {
      return;
    }
    
    document.querySelector('#ks-popup').classList?.toggle('ks-active');
    const iframe = document.querySelector('#ks-popup > div > iframe') as HTMLIFrameElement;
    iframe.src = `${target.href}`;

    e.preventDefault();
  }
  console.log(e.target);
}

function onInit() {
  (function(w) {
    const s = { insideIframe: false, scrollX: 0, scrollY: 0 };
    const iframe = document.querySelector('#ks-popup > div > iframe') as HTMLIFrameElement;

    iframe.addEventListener('mouseenter', () => {
        s.insideIframe = true;
        s.scrollX = w.scrollX;
        s.scrollY = w.scrollY;
    });
    
    iframe.addEventListener('mouseleave', () => {
        s.insideIframe = false;
    });

    document.addEventListener('scroll', () => {
        if (s.insideIframe)
            w.scrollTo(s.scrollX, s.scrollY);
    });
  })(window);
}

function onCheck() {
  const iframe = document.querySelector('#ks-popup > div > iframe') as HTMLIFrameElement;
  const contentDocument = iframe.contentDocument;

  if (contentDocument.querySelector('html'))
    (contentDocument.querySelector('html') as any).style = 'overflow-x: hidden;';
  
  if (contentDocument.querySelector('main#container'))
    (contentDocument.querySelector('main#container') as any).style = 'margin: 20px;';

  if (contentDocument.querySelector('header'))
    (contentDocument.querySelector('header') as any).style = 'display: none';

  if (contentDocument.querySelector('.gnb_bar'))
    (contentDocument.querySelector('.gnb_bar') as any).style = 'display: none';

  if (contentDocument.querySelector('.issue_wrap'))
    (contentDocument.querySelector('.issue_wrap') as any).style = 'display: none';

  if (contentDocument.querySelector('section > article + article + article'))
    (contentDocument.querySelector('section > article + article + article') as any).style = 'display: none';
  if (contentDocument.querySelector('footer'))
    (contentDocument.querySelector('footer') as any).style = 'display: none';
  if (contentDocument.querySelector('.stickyunit'))
    (contentDocument.querySelector('.stickyunit') as any).style = 'display: none;';

  if (contentDocument.querySelector('.page_head'))
    (contentDocument.querySelector('.page_head') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('.gallview_head'))
    (contentDocument.querySelector('.gallview_head') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('.gallview_contents'))
    (contentDocument.querySelector('.gallview_contents') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('.view_comment'))
    (contentDocument.querySelector('.view_comment') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('section > article > *'))
    (contentDocument.querySelector('section > article > *') as any).style = 'width: 95vw;';
  if (contentDocument.querySelector('.writing_view_box > div'))
    (contentDocument.querySelector('.writing_view_box > div') as any).style = 'width: 90vw;';

  if (contentDocument.querySelector('.cmt_list'))
    (contentDocument.querySelector('.cmt_list') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('.cmt_write > textarea'))
    (contentDocument.querySelector('.cmt_write > textarea') as any).style = 'width: calc(95vw - 50px);';
  if (contentDocument.querySelector('.cmt_cont_bottm'))
    (contentDocument.querySelector('.cmt_cont_bottm') as any).style = 'width: calc(95vw - 26px);';
  if (contentDocument.querySelector('.view_bottom_btnbox'))
    (contentDocument.querySelector('.view_bottom_btnbox') as any).style = 'width: 95vw';
  if (contentDocument.querySelector('.view_bottom_btnbox + div'))
    (contentDocument.querySelector('.view_bottom_btnbox + div') as any).style = 'width: 93vw';
}

let onCheckInterval: NodeJS.Timeout;
const componentPopup: Component = {
  create () {
    document.body.prepend(createElement(/* html */`
      <div id="ks-popup">
        <div>
          <iframe id="ks-popup-iframe"></iframe>
        </div>
      </div>
    `));
    document.addEventListener('click', onClickEvent);
    
    onInit();
    
    onCheckInterval = setInterval(onCheck, 100);

    const wrapper = document.querySelector('#ks-popup')

    // 화면 닫기 이벤트
    wrapper.addEventListener('click', e => {
      const target = e.target as HTMLElement
      if (target.id === 'ks-popup') {
        target.classList?.toggle('ks-active')
        
        const iframe = document.querySelector('#ks-popup > div > iframe') as HTMLIFrameElement;
        iframe.src = 'about:blank';
      }
    })
  },
  destroy () {
   document.querySelector('#ks-popup')?.remove()
   document.removeEventListener('click', onClickEvent)
   clearInterval(onCheckInterval);
  }
};

export default componentPopup;
