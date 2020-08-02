import pLimit from 'p-limit'
import pRetry from 'p-retry'
import Push from 'push.js'

import cache from './cache'
import Config from './config'
import IpData from './ipData'
import { createElement, hasAdminPermission } from './utils'

const bodyPattern = /(?<body><body[^>]*>((.|[\n\r])*)<\/body>)/im

const checkboxTemplate = createElement(/* html */`
  <td class="gall_chk">
    <span class="checkbox">
      <input type="checkbox" name="chk_article[]" class="list_chkbox article_chkbox">
      <em class="checkmark"></em>
    </span>
  </td>
`)

export default function request(opts: string | GM_RequestInfo) {
  const options = typeof opts === 'string' ? { url: opts } : opts

  options.method = options.method ?? 'GET'

  return new Promise<GM_Response>((resolve, reject) => {
    GM_xmlhttpRequest({
      ...options,
      onload: res => {
        if (res.readyState !== 4) {
          return
        }

        resolve(res)
      },
      onerror: res => {
        reject(new Error(`Request failed (${res.finalUrl}, ${res.readyState})`))
      }
    })
  })
}

/**
 * 게시글 내용을 파싱한 뒤 캐시에 추가합니다
 * @param gallery 갤러리 아이디
 * @param post 게시글 번호
 */
export async function fetchPost(gallery: string, post: number | string) {
  const element = document.querySelector(`tr[data-no="${post}"]`)

  // 미리보기 대기 중 클래스 추가하기
  element?.classList.add('ks-loading')

  const res = await request({
    url: `https://m.dcinside.com/board/${gallery}/${post}`,
    timeout: 5000,
    headers: {
      'user-agent': 'Mozilla/5.0 (Android 7.0; Mobile)'
    }
  })

  // 이미 삭제된 게시글이라면 오류 반환하기
  if (res.status === 403) {
    throw new pRetry.AbortError(`#${post} 403`)
  }

  if (res.status < 200 || res.status > 299) {
    throw new Error(`#${post} server returned ${res.status} code`)
  }

  // body 태그만 가져오기
  const matches = res.responseText.match(bodyPattern)
  if (!matches) {
    throw new Error(`#${post} Server returned invalid response`)
  }

  const $ = createElement(matches.groups.body).parentNode
  const content = $.querySelector<HTMLElement>('.thum-txtin')

  // 불필요한 태그 전부 제거하기
  const query = '*:not(img):not(iframe):not(br):empty'
  for (let e of content.querySelectorAll(query)) {
    e.remove()
  }

  // p > br 전부 br 하나로 변환하기
  for (let e of content.querySelectorAll('p')) {
    if (e.children.length === 1 && e.firstElementChild.tagName === 'BR') {
      e.remove()
    }
  }

  // 모든 이미지 원본 주소로 변환하기
  for (let img of content.querySelectorAll('img')) {
    const src = img.dataset.original ?? img.src

    while (img.attributes.length) {
      img.removeAttribute(img.attributes[0].name)
    }

    img.src = src
  }

  // 2개 이상 <br> 태그 한개로 변환하기
  content.innerHTML = content.innerHTML.replace(/(<br(\s+\/)?>\s{0,}){2,}/g, '<br>')

  // 푸시 알림 울리기 위해 일치하는지 확인하기
  const notifiaction = Config.get('live.notification')
  const rules = Config.get('live.notification_rules')

  if (notifiaction && rules) {
    const title = element.querySelector('.gall_tit').textContent
    const text = `${title}\n${content.innerHTML}`

    for (let rule of rules) {
      if (text.match(rule)) {
        Push.create(title, {
          body: content.textContent,
          link: `https://gall.dcinside.com/board/view/?id=${gallery}&no=${post}`
        })
        break
      }
    }
  }

  // 캐싱하기
  cache.set(gallery, post, content)

  // 미리보기 대기 중 클래스 삭제하기
  element?.classList.remove('ks-loading')

  return content
}

/**
 * 여러 게시글을 불러와 캐시에 추가합니다
 * @param gallery 갤러리 아이디
 * @param posts 게시글 번호들
 */
export async function fetchPosts(gallery: string, posts: (number | string)[]) {
  const promises = []
  const limit = pLimit(Config.get<number>('live.thread'))

  for (let post of posts) {
    const retries = Config.get<number>('live.retries')
    const promise = () => fetchPost(gallery, post)
    const retry = pRetry(promise, {
      retries,
      onFailedAttempt: error => {
        console.error(`#${post} ${error.message} (${error.attemptNumber} tried / ${error.retriesLeft} left)`)
      }
    })

    promises.push(limit(() => retry))
  }

  // 현재 불러온 게시글 전체 캐싱하기
  await Promise.all(promises)
}

interface GalleryInfo {
  id: string;
  page: number;
  showHeadId?: boolean;
}

interface GalleryView {
  no: number;
  headnum: number;
  headtext: string;
  subject: string;
  name: string;
  ip: string;
  write_time: string;
  hit: number;
  nicktype: string;
  ismember: number;
  recommend: number;
  user_id: string;
  total_comment: number;
  title_icon: string;
}

function titleIcon({ title_icon, headnum }: GalleryView) {
  if (headnum <= -2000000000) return 'icon_notice';
  [
    ['icon_toprecoming', 'sp-lst-recotop'],
    ['icon_recomimg', 'sp-lst-recoimg'],
    ['icon_recomtxt', 'sp-lst-recotxt'],
    ['icon_txt', 'sp-lst-txt'],
    ['icon_pic', 'sp-lst-img'],
    ['icon_movie', 'sp-lst-play'],
  ]
  .filter(x => title_icon === x[1])
  .forEach(x => title_icon = title_icon.replace(x[1], x[0]));
  return title_icon;
}

function nickType(type: string) {
  [
    ['m-gonick', 'https://nstatic.dcinside.com/dc/w/images/fix_managernik.gif'],
    ['m-nogonick', 'https://nstatic.dcinside.com/dc/w/images/managernik.gif'],
    ['sub-gonick', 'https://nstatic.dcinside.com/dc/w/images/fix_sub_managernik.gif'],
    ['sub-nogonick', 'https://nstatic.dcinside.com/dc/w/images/sub_managernik.gif'],
    ['gonick', 'https://nstatic.dcinside.com/dc/w/images/fix_nik.gif'],
    ['nogonick', 'https://nstatic.dcinside.com/dc/w/images/nik.gif'],
  ]
  .filter(x => type.indexOf(x[0]) !== -1)
  .forEach(x => type = x[1]);
  return type;
}

function convServal(serval: string) {
  [
    ['search_all', 'all'],
    ['search_subject', 'subject'],
    ['search_memo', 'memo'],
    ['search_name', 'name'],
    ['search_subject_memo', 'subject_m']
  ]
  .filter(x => serval === x[0])
  .forEach(x => serval = x[1]);
  return serval;
}

interface IpInfo {
  ip: string;
  desc: string;
  ipColor: string;
  descColor: string;
  country: string;
  types: string;
  isMobile: boolean;
  isVPN: boolean;
}

// import ipData from '../data/ipData.json';
function getIpInfo(ip: string) {
  const ipInfo: IpInfo = {
    ip,
    desc: '',
    ipColor: 'black',
    descColor: '',
    country: '',
    types: '',
    isMobile: null,
    isVPN: null
  };

  const ipData = IpData.ipData;
  const ipDataAll = IpData.ipDataAll;

  if (!ipData) {
    ipInfo.desc = '???';
    return ipInfo;
  }

  const info = ipData[ip];
  if (!info) {
    const info2 = ipDataAll[ip];
    if (!info2) {
      ipInfo.desc = 'unknown';
      ipInfo.ipColor = 'red';
      ipInfo.descColor = 'red';
      ipInfo.country = '???';
      return ipInfo;
    }
    
    ipInfo.desc = info2[0];
    ipInfo.ipColor = 'red';
    ipInfo.descColor = 'red';
    ipInfo.country = info2[1];
    ipInfo.types = info2[2];
    return ipInfo;
  } else {
    ipInfo.ip = ip;
    ipInfo.desc = info[0];
    ipInfo.country = info[1];
    ipInfo.types = info[2];
  }

  if (ipInfo.country === 'KR') {
    ipInfo.descColor = 'green';
  }
  if (ipInfo.types === 'mobile') {
    ipInfo.descColor = 'blue';
  }
  if (ipInfo.types === 'VPN') {
    ipInfo.ipColor = 'red';
    ipInfo.descColor = 'red';
    ipInfo.country = '해외';
  }
  if (ipInfo.types === 'TOR') {
    ipInfo.ipColor = 'red';
    ipInfo.descColor = 'red';
    ipInfo.country = '토르';
  }
  return ipInfo;
}

  // icon_notice = 
  // icon_toprecoming = sp-lst-recotop
  // icon_recomimg = sp-lst-recoimg
  // icon_recomtxt = sp-lst-recotxt
  // icon_txt = sp-lst-txt
  // icon_pic = sp-lst-img
  // icon_movie = sp-lst-play
  // 
  // sp-lst-txt -> .icon_text
  // sp-lst-img -> .icon_image

/**
 * HTML 변환 템플릿
 */
export function createRowPosts(info: GalleryInfo, view: GalleryView) {
  const { id, page, showHeadId } = info;
  const {
    no,
    headtext,
    subject,
    name,
    ip,
    total_comment,
    write_time,
    hit,
    nicktype,
    user_id,
    ismember,
    recommend
  } = view;
  const tr = document.createElement('tr');
  tr.setAttribute('class', 'ub-content us-post');
  tr.setAttribute('data-no', `${no}`);
  tr.setAttribute('data-type', titleIcon(view)); // 고쳐야함

  const ipInfo = getIpInfo(ip);

  tr.innerHTML = `
    <td class="gall_num">${no}</td>
    ${showHeadId ? `<td class="gall_subject">${headtext}</td>` : ''}
    <td class="gall_tit ub-word">
      <a href="/mgallery/board/view/?id=${id}&no=${no}&_rk=Zxh&page=${page}"><em class="icon_img ${titleIcon(view)}"></em>${subject}</a>
      <a class="reply_numbox" href="https://gall.dcinside.com/mgallery/board/view/?id=${id}&no=${no}&t=cv&page=${page}&_rk=rrh">${total_comment ? `<span class="reply_num">[${total_comment}]</span>` : ''}</a>
    </td>
    <td class="gall_writer ub-writer" data-nick="${name}" data-uid="${user_id}" data-ip="${ip}" data-loc="list">
      ${ismember ?
        `<span class="nickname in" title="${name}"><em>${name}</em></span><a class="writer_nikcon"><img src="${nickType(nicktype)}" border="0" title="${user_id} : 갤로그로 이동합니다." width="12" height="11" style="margin-left:2px;cursor:pointer;" onclick="window.open('//gallog.dcinside.com/${user_id}');" alt="갤로그로 이동합니다."></a>
         <span class="nickname in" style="font-size: 12px;color: #888;"><em>[${user_id}]</em></span>` :
        `<span class='nickname' title='${name}'><em>${name}</em></span><span class="ip" style="color: ${ipInfo.ipColor}">${ip.length ? `(${ip})` : ''}</span>
         <span class="nickname" title='${ipInfo.desc}' style="font-size: 12px;color: ${ipInfo.descColor};"><em>[${ipInfo.desc}]</em></span>`}
    </td>
    <td class="gall_date" title="${write_time}">${write_time}</td>
    <td class="gall_count">${hit}</td>
    <td class="gall_recommend">${recommend}</td>
  `;
  return tr;
}

/**
 * 게시글 목록을 불러온 뒤 처리합니다
 * @param gallery 갤러리 아이디
 * @param html 이미 처리된 HTML 코드
 */
export async function fetchList(gallery: string) {
  const page = +(/(?:\?|&)page=([\d]+)/.exec(document.location.href) || [0, 1])[1];
  const headid = +(/(?:\?|&)search_head=([\d]+)/.exec(document.location.href) || [0, undefined])[1];
  const list_num = +(/(?:\?|&)list_num=([\d]+)/.exec(document.location.href) || [50, 50])[1];
  const s_type = (/(?:\?|&)s_type=([\d]+)/.exec(document.location.href) || ['', ''])[1];
  const serval = (/(?:\?|&)s_keyword=([\d]+)/.exec(document.location.href) || ['', ''])[1];
  const recommend = /(?:\?|&)exception_mode=recommend/.test(document.location.href);
  const notice = /(?:\?|&)exception_mode=notice/.test(document.location.href);

  // 말머리 있는 갤러리 여부 확인
  const showHeadId = !![...document.querySelectorAll('th[scope="col"]')].filter(x => x.textContent === '말머리').length;

  let data = `id=${gallery}&page=${page}`;
  if (headid) data += `&headid=${headid}`;
  if (s_type) data += `&s_type=${s_type}`;
  if (serval) data += `&serval=${convServal(serval)}`;
  if (recommend) data += '&recommend=1';
  if (notice) data += '&notice=1';

  // const list_count = get_cookie('list_count=100');

  const rep = await request({
    method: 'POST',
    url: 'https://m.dcinside.com/ajax/response-list',
    data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `https://m.dcinside.com/board/${gallery}?page=${page}`,
      'Origin': 'https://m.dcinside.com',
      'Cookie': `list_num=${list_num}; ${document.cookie}`
    },
  });

  console.log(rep.responseText);

  let entirePosts = {};
  try {
    const json = JSON.parse(rep.responseText)
    entirePosts = json.gall_list.data
      .sort((a: any, b: any) => b.no - a.no)
      .map((x: never) => createRowPosts({ id: gallery, page: 1, showHeadId }, x));
  } catch {
    console.error('parse error');
  }
  console.log(entirePosts);

  const addedPosts = [] // 실제로 추가된 게시글 요소
  const fetchedPosts = [] // 응답 받은 게시글 요소

  const table = document.querySelector('.gall_list tbody')
  // const $ = createElement(matches.groups.body).parentNode


  for (let fetchedPost of entirePosts as NodeListOf<HTMLElement>) {
    if (fetchedPost.querySelector('.icon_notice, .icon_survey')) {
      continue
    }

    // 보기 페이지에서 현재 글은 따로 표시되므로 제외하기
    if (fetchedPost.matches('.crt')) {
      continue
    }

    // 데이터 셋에 글 번호 붙이기
    const fetchedString = fetchedPost.querySelector('.gall_num').textContent
    const fetched = parseInt(fetchedString, 10)
    fetchedPost.dataset.no = fetchedString
    fetchedPosts.push(fetched)

    // 기존 게시글 요소 불러오기
    const post = table.querySelector(`[data-no="${fetched}"]`)

    if (post) {
      // 새 글 인식표 지우기
      post.classList.remove('ks-update')

      // 수정된 부분만 변경하기
      for (let fetchedTd of fetchedPost.querySelectorAll('td')) {
        const selector = fetchedTd.className.match(/(gall_\w+)/)[1]
        const td = post.getElementsByClassName(selector)[0]

        if (td?.innerHTML !== fetchedTd.innerHTML) {
          td.innerHTML = fetchedTd.innerHTML
        }
      }
    } else {
      // 관리 권한 있다면 체크박스 추가하기
      if (hasAdminPermission()) {
        fetchedPost.prepend(checkboxTemplate.cloneNode(true))
      }
    }

    if (!cache.has(gallery, fetched)) {
      // 아예 존재하지 않는다면 테이블에 추가하기
      fetchedPost.classList.add('ks-update')
      table.prepend(fetchedPost)
      addedPosts.push(fetched)
    }
  }

  // 최대 글 수를 넘어서면 마지막 글 부터 제거하기
  const limit = Config.get<number>('live.limit_items')
  const overflowed = table.querySelectorAll('tr:not([data-notice])').length - limit

  for (let i = 0; i < overflowed; i++) {
    table.lastElementChild.remove()
  }

  // 삭제된 글이라면 삭제 클래스 붙여주기
  let looped = 0

  for (let post of table.querySelectorAll<HTMLElement>('tr:not([data-notice])')) {
    const no = parseInt(post.dataset.no, 10)

    // 가져온 글 수만큼 반복 돌렸다면 나가기
    if (fetchedPosts.length < ++looped) {
      break
    }

    // 방금 추가된 글이거나 이미 삭제된 게시글이면 무시하기
    if (post.matches('.ks-update, .ks-deleted')) {
      continue
    }

    // 이슈 글과 광고 글은 지우기
    if (post.querySelector('.icon_issue, .icon_ad')) {
      post.remove();
    }

    if (!fetchedPosts.includes(no)) {
      post.classList.add('ks-deleted')
      post.querySelector('input')?.remove() // 체크박스 지우기
    }
  }

  // 테이블에 추가 필요한 요소는 내용 불러오기
  if (addedPosts.length > 0) {
    await fetchPosts(gallery, addedPosts)
  }
}
