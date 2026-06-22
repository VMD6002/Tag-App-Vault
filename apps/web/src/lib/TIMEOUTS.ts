const TIMEOUTS = {
  timeouts: [],
  // @ts-ignore
  setTimeout: function (fn, delay) {
    const id = setTimeout(fn, delay);
    // @ts-ignore
    this.timeouts.push(id);
  },
  clearAllTimeouts: function () {
    while (this.timeouts.length) {
      clearTimeout(this.timeouts.pop());
    }
  },
};
export default TIMEOUTS;
