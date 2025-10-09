let users = [], items = [], interactions = [];
let embeddings = {user_embeddings: {}, item_embeddings: {}};

// CSV Parsing using PapaParse (supports large files)
function parseCSV(file, callback){
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    worker: true,
    complete: function(results){
      callback(results.data);
    }
  });
}
