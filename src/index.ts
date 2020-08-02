import componentContext from './components/context'
import componentPopup from './components/popup'
import componentPreview from './components/preview'
import componentTooltip from './components/tooltip'
import cache from './includes/cache'
import Config from './includes/config'
import IpData from './includes/ipData'
import request, { fetchList, fetchPosts } from './includes/request'
import { getParameter, promiseSeries, wait } from './includes/utils'

// @ts-ignore FUCK YOU VSCODE
await new Promise(resolve => window.addEventListener('load', resolve))

if (window.top === window.self) {
  Config.load()
  IpData.load();
  
  // 앱에서 사용할 요소와 스타일 시트 추가하기
  componentPopup.create()
  componentContext.create()
  componentTooltip.create()
  componentPreview.create()
  
  if (document.querySelector('.gall_list')) {
    const gallery = getParameter('id')
    const fetching = []
  
    // 기존 게시글 목록 데이터 셋 초기화하기
    for (let post of document.querySelectorAll('tr.ub-content') as NodeListOf<HTMLElement>) {
      // 게시글 번호
      if (!post.dataset.no) {
        post.dataset.no = post.querySelector('.gall_num').textContent.trim() || getParameter('no')
      }
  
      // 광고
      if (!post.dataset.notice && post.querySelector('.icon_notice, .icon_survey')) {
        post.dataset.notice = ''
      } else if (!cache.has(gallery, post.dataset.no)) {
        // 캐시가 없다면 캐시할 게시글 목록에 추가하기
        fetching.push(post.dataset.no)
      }
    }
  
    // 현재 페이지의 게시글 목록 초기화하기
    // @ts-ignore

    const res = await request({
      url: `https://m.dcinside.com/board/${gallery}`,
      timeout: 5000,
      headers: {
        'user-agent': 'Mozilla/5.0 (Android 7.0; Mobile)'
      }
    })
    
    if (res.responseText.indexOf('penalty-box') !== -1) {
      throw new Error('접근제한 갤러리');
    }

    await fetchPosts(gallery, fetching).catch(console.error)
  
    while (true) {
      const interval = Config.get<number>('live.interval') * 1000
      const promises = [ wait(interval) ]
  
      if (Config.get('live.enabled')) {
        promises.push(fetchList(gallery).catch(console.error))
      }
  
      // @ts-ignore
      await promiseSeries(promises)
    }
  }
}
