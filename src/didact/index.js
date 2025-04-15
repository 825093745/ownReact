/**
 * 模拟 React.createElement
 * 创建Element JSX -> reactDom
 * @param {*} type 
 * @param {*} props 
 * @param  {...any} children 
 * @returns 
 */
const createElement = (type, props, ...children) => {
    return {
        type, 
        props: {
            ...props,
            children: children.map(child => typeof child === 'object' ? child : createTextElement(child))
        }
    }
}

/**
 * 创建text类型的Element
 * @param {*} text 
 * @returns 
 */
const createTextElement = (text) => {
    return {
        type: 'TEXT_ELEMENT',
        props: {
            nodeValue: text,
            children: [],
        }
    }
}

/**
 * 根据fiber节点，创建dom（浏览器能识别的dom）
 * @param {*} fiber 
 * @returns 
 */
const createDom = (fiber) => {
   
    // 创建dom，如果是对象就创建普通节点。如果是text，就创建文本节点
    const dom = fiber.type === 'TEXT_ELEMENT' ? document.createTextNode('') :  document.createElement(fiber.type)

    // 通过调用updateDom 将组件上的props赋值到dom节点上
    updateDom(dom, {}, fiber.props);

    return dom

}

/**
 * 模拟 ReactDom.render
 * 渲染fiberTree，将其渲染到浏览器上
 * @param {*} element 
 * @param {*} container 
 */
const render = (element, container) => {
    
    // 创建一个根fiber节点
    wipRoot = {
      dom: container, 
      props: {
        children: [element]
      },
      alternate: currentRoot, // alternate指向上一次渲染的fiber树
    }
    deletions = []
    workInProgress = wipRoot
}

// render阶段待处理的fiber节点
let workInProgress = null
// 当前页面上已有的fiber树（上次渲染的fiber树）
let currentRoot = null
// 当前正在进行渲染的fiber树
let wipRoot = null
// 要删除的旧fiber节点数组
let deletions = null

/**
 * 将fiber树的dom挂载到容器dom上
 */
const commitRoot = () => {
  // 循环deletions数组，让其中的节点从dom中删除
  deletions.forEach(commitWork)
  // 通过递归的形式，从rootfiber开始进行挂载
  commitWork(wipRoot.child)
  // commit完成后，将刚刚挂载的fiber树赋给currentRoot
  currentRoot = wipRoot
  // 将表示当前渲染的fiber树指针置空
  wipRoot = null
}

/**
 * 通过递归的形式挂载fiber树上的每个fiber的dom
 * 因为存在function类型的组件，所以fiber树上的每个节点不一定都有do，如下面的例子，
 * <div id='root'>
 *    <APP/>
 *    <div id='r1'>
 *        <Sub/>
 *    </div>
 * </div>
 * 
 * App = () => <div id='a1'></div>
 * Sub = () => <div id='s1'></div>
 *
 * fiber Tree为
 *          div(root)
 *      APP       div(r1)
 *   div(a1)        Sub
 *                  div(s1)
 * 
 * 因为App和Sub两个节点为function组件的fiber节点，没有dom的，所以之后渲染出的html为
 * <div id='root'>
 *    <div id='a1'></div>
 *    <div id='r1'>
 *        <div id='s1'></div>
 *    </div>
 * </div>
 * 
 * dom树为
 *          div(root)
 *    div(a1)         div(r1)
 *                    div(s1)
 * 
 * 因此根据fiber树 不管是挂载dom还是删除dom的时候，都要略过function fiberNode
 * @param {*} fiber 
 * @returns 
 */
const commitWork = (fiber) => {
  if (!fiber) {
    return
  }
  // const domParent = fiber.parent.dom
  // 从当前节点向上查找，直到找到带有dom的祖先fiber节点
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  
  if (fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
    // 如果fiber的标签是PLACEMENT，则在最近的具有dom的fiber的dom上挂载该fiber的dom
    domParent.appendChild(fiber.dom)
  } else if (fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    // 如果fiber的标签是UPDATE，则在原来的dom上修改其props
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  } else if (fiber.effectTag === 'DELETION') {
    // 如果fiber的标签是DELETION，当前fiber节点向下查找，直到知道有dom的fiber节点，然后从domParent中删除该fiber节点的dom
    commitDeletion(fiber, domParent)
  }
 
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

/**
 * 删除dom的逻辑
 * @param {*} fiber 
 * @param {*} domParent 
 */
const commitDeletion = (fiber, domParent) => {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

/**
 * 更新dom节点的props
 * @param {*} dom  被更新的dom节点
 * @param {*} prevProps 更新前的props
 * @param {*} nextProps 要更新的props
 */
const updateDom = (dom, prevProps, nextProps) => {
  // props不是on开头的属性（事件处理程序）
  const isEvent = key => key.startsWith("on")
  // props不是children属性也不是on开头的属性（事件处理程序）
  const isProperty = key => key !== "children" && !isEvent(key)
  // 该属性是新增的props
  const isNew = (prev, next) => key =>
    prev[key] !== next[key]
  // 该属性是要被删除的props
  const isGone = (prev, next) => key => !(key in next)

  // 删除旧的事件处理程序
  // 针对于事件处理程序，如果事件处理程序发生变化，则从节点中删除
  Object.keys(prevProps)
  .filter(isEvent)
  .filter(
    key =>
      !(key in nextProps) ||
      isNew(prevProps, nextProps)(key)
  )
  .forEach(name => {
    const eventType = name
      .toLowerCase()
      .substring(2)
    dom.removeEventListener(
      eventType,
      prevProps[name]
    )
  })

  // 删除旧的props
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ""
    })

  // 设置新的props
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name]
    })

  // 添加新的事件处理程序
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name
        .toLowerCase()
        .substring(2)
      dom.addEventListener(
        eventType,
        nextProps[name]
      )
    })
}

/**
 * 
 * @param {*} deadline 
 * deadline.timeRemaining(): 剩余的空闲时间
 */
const workLoop = (deadline) => {
  let shouldYield = false

  // render阶段
  // 循环处理fiber树，通过执行performUnitOfWork方法来实现。
  while (workInProgress && !shouldYield) {
    workInProgress = performUnitOfWork(
      workInProgress
    )
    // 是否需要暂停（让位）
    shouldYield = deadline.timeRemaining() < 1
  }

  // commit阶段
  // 当处理完fiber树上的所有fiber节点后，再统一提交
  if (!workInProgress && wipRoot) {
    commitRoot()
  }
  requestIdleCallback(workLoop)
}

// 这个是浏览器原生的js函数，用于在浏览器空闲时期调度低优先级任务
requestIdleCallback(workLoop)

/**
 * 1、处理当前 fiber 节点（创建 DOM 当不挂载）
 * 2、为所有子元素初始化 fiber 结构
 * 3、按照 child → sibling → parent 的顺序返回下一个待处理的 fiber
 * @param {*} fiber 
 * @returns 
 */
const performUnitOfWork = (fiber) => { 
  // 是否为函数组件
  const isFunctionComponent = fiber.type instanceof Function

  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }



  // return next unit of work
  // 如果有子节点就返回子节点
  if (fiber.child) {
    return fiber.child
  }
  // 没有直接的就返回下一个兄弟节点，直到返回自己的父节点
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

/**
 * 根据wipFiber，创建wipFiber节点的子fiber节点，并将其连接起来
 * @param {*} wipFiber 
 * @param {*} elements 
 */
const reconcileChildren = (wipFiber, elements) => {
  let index = 0
  let oldFiber = wipFiber?.alternate?.child;
  let prevSibling = null

  // 根据fiber的children创建fiber的子节点。fiber的child指针指向第一个子节点，然后每个子节点的siblig指向同级的下一个节点
  while (index < elements.length || oldFiber) {
    const element = elements[index]

    let newFiber = null;

    const sameType = element && oldFiber && element.type === oldFiber.type

    // 表示需要更新节点
    // 如果是相同的type，则创建一个fiber，复用oldFiber的type和dom，effectTag设为UPDATE
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      }
    }
    // 表示需要在新fiber树上新增节点
    // 创建一个fiber，dom为空，effectTag设为PLACEMENT
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      }
    }
    // 表示需要删除旧oldFiber节点
    // 在oldFiber上，将effectTag设为DELETION，并将要删除的fiber节点添加到deletions数组中
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION"
      deletions.push(oldFiber)
    }

    // 获取下一个oldFiber
    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      // fiber的child指针指向第一个子节点
      wipFiber.child = newFiber
    } else {
      // 上一个兄弟fiber节点的sibling指向当前节点（弟弟节点）
      prevSibling.sibling = newFiber
    }
    prevSibling = newFiber
    index++
  }
}

/**
 * 为非函数组件fiber创建dom，并创建其子fiber
 * @param {*} fiber 
 */
const updateHostComponent = (fiber) => {
  // add dom node
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  // 创建子元素的fiber节点
  reconcileChildren(fiber, fiber.props.children)
}

// 当前正在运行的fiber
let wipFiber = null;
// hook的索引，hook自己是根据索引来区分的
let hookIndex = null
/**
 * 运行函数组件的来获取并创建其子fiber
 * 当此时，function类型的fiber节点是没有dom的
 * @param {*} fiber 
 */
const updateFunctionComponent = (fiber) => {
  wipFiber = fiber;
  hookIndex = 0
  // 用来存储当前fiber（当前组件）中所有的hook
  wipFiber.hooks = [];
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

/**
 * 模拟useState
 * @param {*} initial 
 */
const useState = (initial) => {
  // 根据当前的hookIndex来获取老的hook
  const oldHook = wipFiber?.alternate?.hooks?.[hookIndex];
  // 创建hook，如果老的hook有自，就取老的state，否则就取initial
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  }

  // 从队列中以此取出stateValue，然后设置到hook的state中
  const stateValues = oldHook ? oldHook.queue : []
  stateValues.forEach(stateValue => {
    hook.state = stateValue instanceof Function ? stateValue(hook.state) : stateValue
  })

  const setState = stateValue => {
    // 将设置的值添加的hook队列中
    hook.queue.push(stateValue)
    // 将wipRoot以及workInProgress设为根节点，表示下个时间片进行render的时候是从根节点进行render
    // 注意，这里是渲染了整棵树，但是在真实的react中是从当前节点开始向下渲染
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    workInProgress = wipRoot
    deletions = []
  }

  // 将刚刚创建的hook添加的fiber的hooks组件中
  wipFiber.hooks.push(hook)
  // 索引+1
  hookIndex++
  // 返回hook的state
  return [hook.state, setState]
}


  
export {useState}

export default {
  createElement,
  render
}