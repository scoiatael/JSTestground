
var error_handler = function(res, stat, xhr) {
  if(status === "error") {
    alert("Encountered error: " + xhr.status + " " + xhr.statusText)
  }
  // console.log("response: " + res);
};

var safe_load = function(where, what) {
  console.log("Trying to load " + what );
  where.load(what, error_handler);
}
