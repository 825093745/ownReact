import Didact, {useState} from "../didact";

/** @jsx Didact.createElement */
const Counter = () => {
    const [state, setState] = useState(1)
   
    return (
      <h1 onClick={() => setState(state + 1)} style="user-select: none">
        Count: {state}
      </h1>
    )
}
export default Counter