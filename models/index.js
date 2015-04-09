/**
 * Created by Roman on 12.02.2015.
 */
module.exports = function(db){
    "use strict";
    //require('./conversation')(db);
    require('./user')(db);
    require('./conversation')(db);
    require('./socketConnection')(db);
    require('./addressBook')(db);
    require('./countries')(db);
};