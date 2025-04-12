import Didact from "./didact";
import Counter from './components/Counter'

/** @jsx Didact.createElement */
function App(props) {
  /** @jsx Didact.createElement */
  const counter = <Counter/>
  return (
    <div>
      <h1 title="foo">{props.name}</h1>
      {counter}
    </div>    
  )
}

export default App;
