# 可能出现的问题
> 如果出现 Error: error:0308010C:digital envelope routines::unsupported 这样的错误
- macOS将start命令改为  
```
"start": "export NODE_OPTIONS=--openssl-legacy-provider && react-scripts start",
```
- windows将start命令改为
```
"start": "set NODE_OPTIONS=--openssl-legacy-provider && react-scripts start"
```

# react实现流程
0. 首先介绍一下fiber节点的构成
```
    fiberNode={
        type, // 节点类型
        props: { // props
            ...rest,
            children: [] // 子节点，是个数组
        },
        stateNode, // fiber节点关联的真实实例。对于函数组件该字段为空，对于宿主组件（div等），该值为对应的真实dom。在该项目中，叫dom字段
        alternate, // 双缓存机制下，对应的旧的fiber节点
        effectTag, // 在进行节点更新的时候，为节点打的标签，分为：PLACEMENT（新增），UPDATE（修改），DELETION（删除）
        hooks, // 针对于函数组件，当前节点下挂载的hook链表
        child, // 指向第一个子节点
        sibling, // 指向自己的下一个兄弟节点
        return, // 指向自己的父节点
    }
```

1. 运行Scheduler调度器，确定调度任务的优先级，在保证页面高响应的前提下，在有空闲时间的时候进行render操作。（之前的古旧版本用的是requestIdleCallback）
```
requestIdleCallback(workLoop)
```

2. 在调度器中，会在空闲时间执行一个workLoop方法，该方法会通过迭代的形式在空闲时间足够的情况下处理workInProgress节点
```
// render阶段
// 循环处理fiber树，通过执行performUnitOfWork方法来实现。
while (workInProgress && !shouldYield) {
    workInProgress = performUnitOfWork(
        workInProgress
    )
    // 是否需要暂停（让位）
    shouldYield = deadline.timeRemaining() < 1
}
```

3. 执行ReactDom.render方法，会根据render第二个参数即“容器实例”，创建一个rootFiber节点，其中stateNode=“容器实例”自身，children=第一个参数即“入口组件”， alternate=currentRoot（表示上次渲染的rootFiber）。并将该root节点设为workInProgress。  
如此一来，renderer就可以处理该fiber节点了。同时将该root节点设为wipRoot，表示本次render渲染的根节点
```
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
```

4. 在处理fiber节点的时候，会判断当前节点(wipFiber)对应的是函数组件还是宿主组件  
如果是函数组件，则根据type获取函数名（因为函数组件的type就是函数名），运行该函数后，能获得其子节点。并且其stateNode即对应的真实dom为空  
如果是宿主组件，则通过wipFiber节点中的props.children可以获取到其子节点list。并且会根据其type，props等创建一个真实dom，并通过updateDom方法（后面会讲）将props设置到真实dom上。再将真实dom赋值给stateNode字段  

5. 遍历子节点list，并同时为每个子节点创建newFiber。同时通过wipFiber的alternate获取旧节点的第一个子节点 ```let oldFiber = wipFiber?.alternate?.child;``` 然后通过```oldFiber = oldFiber.sibling``` 在遍历子节点的同时遍历对应的oldFiber

6. 对新旧子节点list进行对比，执行diff算法。然后根据结果，对newFiber打上新增或修改的标签。对没有对应newFiber的oldFiber打上删除的标签，并将其添加到一个deletions数组中  
同时将wipFiber的child指向第一个newFiber。将每个newFiber的sibling指向下一个兄弟节点  
每个newFiber的alternate指向对应的oldFiber（如果有的话），每个newFiber的return指向wipFiber

7. 遍历完子节点后，说明已经创建完所有子节点的fiber了，并且进行了关联
```
wipFiber.child -> firstNewFiber
newFiber.sibling -> nextNewFiber
newFiber.return -> wipFiber
```
至此已经完成了一轮workInProgress节点的处理，处理内容包括创建节点的真实dom，根据oldFiber来创建子节点的fiber并添加关联关系和effectTag。  

8. 然后基于现在的workInProgress节点。根据有子节点返回子节点，没有子节点返回下一个兄弟节点，没有下一个兄弟节点返回父节点的形式返回一个fiberNode并设为新的workInProgress节点。整个遍历形式是深度遍历
```
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
```
然后进入下一轮的workInProgress处理。直到返回的workInProgress为空。  
以上阶段都属于render阶段，都需要基于react的Schedule调度器来进行调度运行，在空闲的时间以5ms为一个时间片运行，时间片到期或者有其他紧急任务的时候会中断render，下次回来执行的时候会基于上次中断处继续执行

9. 当workInProgress为空后就进入到commit阶段。commit阶段是一鼓作气完成的。
```
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
```

10. 首先对deletions数组进行commitWork操作，即从父节点的dom中进行删除，如果当前节点是函数组件没有对应的dom，则删除其子节点dom  
```
const commitDeletion = (fiber, domParent) => {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}
```

11. 从wipRoot.child开始，以递归的形式深度遍历来执行commitWork操作。 
只针有真实dom的fiber即宿主组件进行操作，函数组件的fiber直接略过。转而处理其子fiber或兄弟fiber   
如果fiber的标签是PLACEMENT，则向上追溯，在最近的具有dom的fiber的dom上挂载该fiber的dom  
如果fiber的标签是UPDATE，则进行updateDom操作。 
```
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
```

12. 在updateDom的时候，会对比新旧props（除了children）。  
针对于on开头的表示事件处理的props，如果新旧props中的事件处理程序发生了变化，则删除对旧事件的监听，添加新事件的监听（真实的react中，事件都是挂载在root节点的）
针对于普通的props，进行新旧对比后，会添加新props，删除旧props

13. commit完成后，将本次渲染的根fiber，即wipRoot赋值给currentRoot，同时将wipRoot设为空。表示此次渲染完成！！  
可以进行下一次的渲染。  
其中针对于每次渲染，上次的rootFiber就是currentRoot（表示目前已经渲染到屏幕上的root节点），本次的rootFiber就是wipRoot


