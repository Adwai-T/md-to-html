export class Stack{
  stack;
  length;
  constructor(){
    this.stack = [];
  }
  
  length() {
    return this.stack.length;
  }

  push(value) {
    this.stack.push(value);
    return this;
  }

  pop() {
    return this.stack.pop();
  }

  peek() {
    return this.stack[this.length-1]
  }

  isEmpyt() {
    return this.stack.length === 0 ? true : false;
  } 
}