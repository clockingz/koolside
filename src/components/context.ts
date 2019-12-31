import { createElement, deletePosts, getParameter,hasAdminPermission } from '../includes/utils'

function onClick (e: MouseEvent) {
  const context = document.querySelector<HTMLElement>('#ks-contextmenu')

  if (e.button === 0) {
    context.classList.remove('ks-active')
  }
}

function onSelectionChange () {
  const selection = window.getSelection()

  // 드래그로 게시글 선택하기
  const items = document.querySelectorAll('tr.ub-content td')

  for (let item of items) {
    const post = item.closest('tr')
    const checkbox = post.querySelector('input')
    const checked = selection.containsNode(item)

    if (checkbox) checkbox.checked = checked
    if (checked) {
      post.classList.add('ks-checked')
    } else {
      post.classList.remove('ks-checked')
    }
  }
}

function onContextMenu (e: MouseEvent) {
  const target = e.target as HTMLElement
  const context = document.querySelector<HTMLElement>('#ks-contextmenu')
  const nativeTags = ['IMG']

  // 설정 화면에선 무시하기
  if (target.closest('#ks-config')) {
    context.classList.remove('ks-active')
    return
  } else if (nativeTags.includes(target.tagName)) {
    // 특정 태그에선 기본 컨텍스 메뉴만 사용하기
    context.classList.remove('ks-active')
    return
  } else if (target.closest('#ks-contextmenu') === context) {
    // 컨텍스 메뉴 켜진 상태에서 한번 더 열었다면 네이티브 컨텍스 열기
    context.classList.remove('ks-active')
    return
  } else {
    context.classList.add('ks-active')

    // 더블 클릭하기 쉽게 위치 이동하기
    context.style.top = `${e.y - 5}px`
    context.style.left = `${e.x - 5}px`

    // 선택한 객체에 z-index 가 있다면 그보다 한 개 높게 설정하기
    if (target.style.zIndex) {
      context.style.zIndex = target.style.zIndex + 1
    }
  }

  context.innerHTML = ''

  const items = []

  const gallery = getParameter('id')
  const clipboard = navigator.clipboard
  const selectedText = window.getSelection().toString()

  const post = target.closest<HTMLElement>('tr.ub-content')
  const number = post?.querySelector('.gall_num').textContent

  // 선택한 게시글 번호만 불러오기
  const checkedPosts = [] as string[]

  for (let checkedPost of document.querySelectorAll('tr.ub-content.ks-checked')) {
    const number = checkedPost.querySelector('.gall_num').textContent
    checkedPosts.push(number)
  }

  // 주소라면
  const link = target.closest('a')

  if (link || post) {
    const url = link?.getAttribute('href') || `https://gall.dcinside.com/board/view/?id=${gallery}&no=${number}`

    items.push({
      name: '새 탭에서 열기',
      url
    })

    items.push({})
  }

  // 게시글이 존재한다면
  if (post) {
    const writer = post.querySelector<HTMLElement>('.gall_writer')
    const author = writer.dataset.nick
    const authorId = writer.dataset.uid || writer.dataset.ip

    items.push({
      name: '게시글 주소 복사',
      onClick () {
        clipboard.writeText(`https://gall.dcinside.com/board/view/?id=${gallery}&no=${number}`)
      }
    })

    items.push({
      name: '작성자 정보 복사',
      onClick () {
        clipboard.writeText(`${author} (${authorId})`)
      }
    })

    if (writer.dataset.uid) {
      items.push({
        name: '작성자 갤로그',
        url: `https://gallog.dcinside.com/${authorId}`
      })
    }
  }

  // 선택한 텍스트가 존재한다면
  if (selectedText) {
    items.push({
      name: '복사',
      onClick () {
        clipboard.writeText(selectedText)
      }
    })
  }

  // 붙여 넣을 수 있는 객체 위에서 열었다면
  if (target.matches('input, textarea')) {
    items.push({
      name: '붙여넣기',
      onClick () {
        navigator.clipboard.readText().then(text => {
          (target as HTMLInputElement | HTMLTextAreaElement).value = text
        })
      }
    })
  }

  // 관리 권한이 있다면
  if (hasAdminPermission()) {
    // 스플리터
    items.push({})

    if (post?.matches(':not(.ks-deleted)')) {
      items.push({
        name: '이 게시글 삭제',
        onClick () {
          if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            deletePosts([ number ])
          }
        }
      })
    }

    // 체크박스 선택한 게시글이 1개 이상이라면
    if (checkedPosts.length > 0) {
      items.push({
        name: '선택한 게시글 삭제',
        onClick () {
          if (confirm(`정말로 게시글 ${checkedPosts.length}개를 삭제하시겠습니까?`)) {
            deletePosts(checkedPosts)
          }
        }
      })
    }
  }

  // 가장 마지막에 설정 메뉴 추가하기
  items.push({})
  items.push({
    name: '글쓰기',
    url: `https://gall.dcinside.com/mgallery/board/write/?id=${gallery}`
  })

  items.push({
    name: '설정',
    onClick () {
      document.querySelector('#ks-config').classList.add('ks-active')
    }
  })

  for (let item of items) {
    const li = document.createElement('li')

    if (item.url) {
      li.innerHTML = `<a href="${item.url}" target="_blank">${item.name}</a>`
    } else if (item.name) {
      li.innerHTML = `<a>${item.name}</a>`
      li.addEventListener('click', item.onClick)
    } else if (!context.lastElementChild?.classList.contains('ks-splitter')) {
      li.classList.add('ks-splitter')
    } else {
      continue
    }

    context.append(li)
  }

  e.preventDefault()
}

const componentContext: Component = {
  create () {
    document.body.prepend(createElement('<ul id="ks-contextmenu"></ul>'))
    document.addEventListener('click', onClick)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('contextmenu', onContextMenu)
  },
  destroy () {
    document.querySelector('#ks-context')?.remove()
    document.removeEventListener('click', onClick)
    document.removeEventListener('selectionchange', onSelectionChange)
    document.removeEventListener('contextmenu', onContextMenu)
  }
}

export default componentContext
