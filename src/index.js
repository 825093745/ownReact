
import './index.css';
import App from './App';
import Didact from "./didact";

/** @jsx Didact.createElement */
const element = <App name="foo" />

// 本质上是这样的
/* const element = Didact.createElement(App, {
  name: "foo",
}) */

Didact.render(
  element, document.getElementById('root')
);

