var forestjs = (function(){
  
  var RandomForest = function(options) {
  }
  
  RandomForest.prototype = {
    train: function(data, labels, options) {
    
      options = options || {};
      this.numTrees = options.numTrees || 100;
      
      this.trees= new Array(this.numTrees);
      for(var i=0;i<this.numTrees;i++) {
        this.trees[i] = new DecisionTree();
        this.trees[i].train(data, labels, options);
      }
    },
    
    predictOne: function(inst) {
      
      var dec=0;
      for(var i=0;i<this.numTrees;i++) {
        dec += this.trees[i].predictOne(inst);
      }
      dec /= this.numTrees;
      return dec;
    },
    
    predict: function(data) {
      
      var probabilities= new Array(data.length);
      for(var i=0;i<data.length;i++) {
        probabilities[i]= this.predictOne(data[i]);
      }
      return probabilities;
      
    }
    
  }
  
  var DecisionTree = function(options) {
  }
  
  DecisionTree.prototype = {
  
    train: function(data, labels, options) {
      
      options = options || {};
      var maxDepth = options.maxDepth || 4;
      var weakType = options.type || 0;
      
      var trainFun= decision2DStumpTrain;
      var testFun= decision2DStumpTest;
      
      if(options.trainFun) trainFun = options.trainFun;
      if(options.testFun) testFun = options.testFun;
      
      if(weakType == 0) {
        trainFun= decisionStumpTrain;
        testFun= decisionStumpTest;
      }
      if(weakType == 1) {
        trainFun= decision2DStumpTrain;
        testFun= decision2DStumpTest;
      }
      
      
      var numInternals= Math.pow(2, maxDepth)-1;
      var numNodes= Math.pow(2, maxDepth + 1)-1;
      var ixs= new Array(numNodes);
      for(var i=1;i<ixs.length;i++) ixs[i]=[];
      ixs[0]= new Array(labels.length);
      for(var i=0;i<labels.length;i++) ixs[0][i]= i; 
      var models = new Array(numInternals);
      
      
      for(var n=0; n < numInternals; n++) {
        
        
        var ixhere= ixs[n];
        if(ixhere.length == 0) { continue; }
        if(ixhere.length == 1) { ixs[n*2+1] = [ixhere[0]]; continue; } 
        
        
        var model= trainFun(data, labels, ixhere);
        models[n]= model; 
        
        
        var ixleft=[];
        var ixright=[];
        for(var i=0; i<ixhere.length;i++) {
            var label= testFun(data[ixhere[i]], model);
            if(label === 1) ixleft.push(ixhere[i]);
            else ixright.push(ixhere[i]);
        }
        ixs[n*2+1]= ixleft;
        ixs[n*2+2]= ixright;
      }
      
      
      var leafPositives = new Array(numNodes);
      var leafNegatives = new Array(numNodes);
      for(var n=numInternals; n < numNodes; n++) {
        var numones= 0;
        for(var i=0;i<ixs[n].length;i++) {
            if(labels[ixs[n][i]] === 1) numones+=1;
        }
        leafPositives[n]= numones;
        leafNegatives[n]= ixs[n].length-numones;
      }
      
      
      this.models= models;
      this.leafPositives = leafPositives;
      this.leafNegatives = leafNegatives;
      this.maxDepth= maxDepth;
      this.trainFun= trainFun;
      this.testFun= testFun;
    }, 
    
    
    predictOne: function(inst) { 
        
        var n=0;
        for(var i=0;i<this.maxDepth;i++) {
            var dir= this.testFun(inst, this.models[n]);
            if(dir === 1) n= n*2+1; 
            else n= n*2+2; 
        }
        
        return (this.leafPositives[n] + 0.5) / (this.leafNegatives[n] + 1.0); 
    }
  }
  
  
  function decisionStumpTrain(data, labels, ix, options) {
    
    options = options || {};
    var numtries = options.numTries || 10;
    
    
    var ri= randi(0, data[0].length);
    var N= ix.length;
    
    
    var H= entropy(labels, ix);
    var bestGain=0; 
    var bestThr= 0;
    for(var i=0;i<numtries;i++) {
    
        
        var ix1= ix[randi(0, N)];
        var ix2= ix[randi(0, N)];
        while(ix2==ix1) ix2= ix[randi(0, N)]; 
        
        var a= Math.random();
        var thr= data[ix1][ri]*a + data[ix2][ri]*(1-a);
        
        
        var l1=1, r1=1, lm1=1, rm1=1; 
        for(var j=0;j<ix.length;j++) {
            if(data[ix[j]][ri] < thr) {
              if(labels[ix[j]]==1) l1++;
              else lm1++;
            } else {
              if(labels[ix[j]]==1) r1++;
              else rm1++;
            }
        }
        var t= l1+lm1;  
        l1=l1/t;
        lm1=lm1/t;
        t= r1+rm1;
        r1=r1/t;
        rm1= rm1/t;
        
        var LH= -l1*Math.log(l1) -lm1*Math.log(lm1); 
        var RH= -r1*Math.log(r1) -rm1*Math.log(rm1);
        
        var informationGain= H - LH - RH;
        
        if(informationGain > bestGain || i === 0) {
            bestGain= informationGain;
            bestThr= thr;
        }
    }
    
    model= {};
    model.thr= bestThr;
    model.ri= ri;
    return model;
  }
  
  
  function decisionStumpTest(inst, model) {
    if(!model) {
        
        return 1;
    }
    return inst[model.ri] < model.thr ? 1 : -1;
    
  }
  
  
  function decision2DStumpTrain(data, labels, ix, options) {
    
    options = options || {};
    var numtries = options.numTries || 10;
    
    
    var N= ix.length;
    
    var ri1= 0;
    var ri2= 1;
    if(data[0].length > 2) {
      
      ri1= randi(0, data[0].length);
      ri2= randi(0, data[0].length);
      while(ri2 == ri1) ri2= randi(0, data[0].length); 
    }
    
    
    var H= entropy(labels, ix);
    var bestGain=0; 
    var bestw1, bestw2, bestthr;
    var dots= new Array(ix.length);
    for(var i=0;i<numtries;i++) {
        
        
        var alpha= randf(0, 2*Math.PI);
        var w1= Math.cos(alpha);
        var w2= Math.sin(alpha);
        
        
        for(var j=0;j<ix.length;j++) {
          dots[j]= w1*data[ix[j]][ri1] + w2*data[ix[j]][ri2];
        }
        
        
        
        
        
        
        
        var ix1= ix[randi(0, N)];
        var ix2= ix[randi(0, N)];
        while(ix2==ix1) ix2= ix[randi(0, N)]; 
        var a= Math.random();
        var dotthr= dots[ix1]*a + dots[ix2]*(1-a);
        
        
        var l1=1, r1=1, lm1=1, rm1=1; 
        for(var j=0;j<ix.length;j++) {
            if(dots[j] < dotthr) {
              if(labels[ix[j]]==1) l1++;
              else lm1++;
            } else {
              if(labels[ix[j]]==1) r1++;
              else rm1++;
            }
        }
        var t= l1+lm1; 
        l1=l1/t;
        lm1=lm1/t;
        t= r1+rm1;
        r1=r1/t;
        rm1= rm1/t;
        
        var LH= -l1*Math.log(l1) -lm1*Math.log(lm1); 
        var RH= -r1*Math.log(r1) -rm1*Math.log(rm1);
        
        var informationGain= H - LH - RH;
        
        if(informationGain > bestGain || i === 0) {
            bestGain= informationGain;
            bestw1= w1;
            bestw2= w2;
            bestthr= dotthr;
        }
    }
    
    model= {};
    model.w1= bestw1;
    model.w2= bestw2;
    model.dotthr= bestthr;
    return model;
  }
  
  
  function decision2DStumpTest(inst, model) {
    if(!model) {
        
        return 1;
    }
    return inst[0]*model.w1 + inst[1]*model.w2 < model.dotthr ? 1 : -1;
    
  }
  
  
  function entropy(labels, ix) {
    var N= ix.length;
    var p=0.0;
    for(var i=0;i<N;i++) {
        if(labels[ix[i]]==1) p+=1;
    }
    p=(1+p)/(N+2); 
    q=(1+N-p)/(N+2);
    return (-p*Math.log(p) -q*Math.log(q));
  }
  
  
  function randf(a, b) {
    return Math.random()*(b-a)+a;
  }

  
  function randi(a, b) {
     return Math.floor(Math.random()*(b-a)+a);
  }

  
  var exports = {};
  exports.DecisionTree = DecisionTree;
  exports.RandomForest = RandomForest;
  return exports;
  
})();
