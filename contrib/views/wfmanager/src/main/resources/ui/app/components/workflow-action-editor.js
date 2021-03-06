/*
*    Licensed to the Apache Software Foundation (ASF) under one or more
*    contributor license agreements.  See the NOTICE file distributed with
*    this work for additional information regarding copyright ownership.
*    The ASF licenses this file to You under the Apache License, Version 2.0
*    (the "License"); you may not use this file except in compliance with
*    the License.  You may obtain a copy of the License at
*
*        http://www.apache.org/licenses/LICENSE-2.0
*
*    Unless required by applicable law or agreed to in writing, software
*    distributed under the License is distributed on an "AS IS" BASIS,
*    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*    See the License for the specific language governing permissions and
*    limitations under the License.
*/

import Ember from 'ember';
import Constants from '../utils/constants';
import CommonUtils from '../utils/common-utils';
import {SlaInfo} from '../domain/sla-info';

export default Ember.Component.extend( Ember.Evented,{
  actionIcons : {
    "hive": "server",
    "hive2": "server",
    "pig": "product-hunt",
    "sqoop": "database",
    "hdfs": "copy",
    "java": "code",
    "shell": "terminal",
    "distcp": "clone",
    "map-reduce": "cubes",
    "spark": "star",
    "ssh": "terminal",
    "sub-workflow":"share-alt-square",
    "stream": "exchange",
    "email": "envelope",
    "fs":"folder-o"
  },
  clonedActionModel : {},
  showingFileBrowser : false,
  childComponents : new Map(),
  errors : Ember.A([]),
  isActionNode : Ember.computed('nodeType',function(){
    if(this.get('nodeType') === 'action'){
      return true;
    }else{
      return false;
    }
  }),
  type : Ember.computed('nodeType','actionType',function(){
    if(this.get('nodeType') === 'action'){
      return this.get('actionType');
    }else if(this.get('nodeType') === 'decision' || this.get('nodeType') === 'kill'){
      return  this.get('nodeType');
    }
  }),
  icon : Ember.computed('actionIcons', 'actionType',function(){
    return this.get('actionIcons')[this.get('actionType')];
  }),
  saveClicked : false,
  unsupportedPropertiesXml : Ember.computed('actionModel.unsupportedProperties', {
    get(key){
      let x2js = new X2JS();
      return vkbeautify.xml(x2js.json2xml_str(this.get('actionModel.unsupportedProperties')));
    },
    set(key, value) {
      let x2js = new X2JS();
      var temp = x2js.xml_str2json(vkbeautify.xmlmin(`<unsupportedProperties>${value}</unsupportedProperties>`));
      this.set('actionModel.unsupportedProperties', temp.unsupportedProperties);
      Object.keys(this.get('actionModel.unsupportedProperties')).forEach(key =>{
        this.set(`actionModel.${key}`, this.get(`actionModel.unsupportedProperties.${key}`));
      });
      return value;
    }
  }),
  actionXml : Ember.computed('actionModel', {
    get(key) {
      let x2js = new X2JS();
      var startTag = `<${this.get('actionType')}`;
      Object.keys(this.get('actionModel')).forEach(key => {
        if(key.startsWith('_')){
          startTag = `${startTag} ${key.substr(1)}="${this.get('actionModel')[key]}"`;
        }
      });
      startTag = `${startTag}>`;
      return vkbeautify.xml(`${startTag}${x2js.json2xml_str(this.get('actionModel'))}</${this.get('actionType')}>`);
    },
    set(key, value) {
      let x2js = new X2JS();
      this.set('errors', Ember.A([]));
      let temp = x2js.xml_str2json(vkbeautify.xmlmin(value));
      if(temp){
        let tempKeys = Object.keys(temp);
        let actionType = tempKeys && tempKeys.get('firstObject')? tempKeys.get('firstObject') : this.get('actionType');
        if(CommonUtils.isSupportedAction(actionType)){
          this.get('errors').pushObject({message: `Looks like you are creating "${actionType}" action. Please use the ${actionType} action editor.`});
        }else{
          this.set('currentNode.actionType', actionType);
          this.set('actionType', actionType);
        }
        if(Ember.isBlank(temp[actionType])){
          this.set('actionModel', {});
        }else{
          this.set('actionModel', temp[actionType]);
        }
      }else{
        this.get('errors').pushObject({message:'Action Xml is syntatically incorrect'});
      }
      return value;
    }
  }),
  fileBrowser : Ember.inject.service('file-browser'),
  onDestroy : function(){
    this.set('transition',{});
    this.get('childComponents').clear();
  }.on('willDestroyElement'),
  setUp : function () {
    var errorNode = Ember.Object.extend(Ember.Copyable).create({
      name : "",
      isNew : false,
      message : ""
    });
    var errorNodeOfCurrentNode = this.get('currentNode').get('errorNode');
    if(errorNodeOfCurrentNode){
      errorNode.set('name', errorNodeOfCurrentNode.get('name'));
      errorNode.set('message', errorNodeOfCurrentNode.get('killMessage'));
    }
    var transition = Ember.Object.extend(Ember.Copyable).create({
      errorNode : errorNode
    });
    this.set('transition',transition);
    if(CommonUtils.isSupportedAction(this.get('actionType'))){
      if (Ember.isBlank(this.get("actionModel.jobTracker"))){
        this.set('actionModel.jobTracker',Constants.rmDefaultValue);
      }
      if (Ember.isBlank(this.get("actionModel.nameNode"))){
        this.set('actionModel.nameNode','${nameNode}');
      }
    }
    if(this.get('nodeType') === 'action' && CommonUtils.isSupportedAction(this.get('actionType')) && this.get('actionModel.slaInfo') === undefined){
      this.set('actionModel.slaInfo', SlaInfo.create({}));
    }
    if(!CommonUtils.isSupportedAction(this.get('actionType')) && !this.get('actionModel.slaInfo')){
      this.set('customSlaInfo',  SlaInfo.create({}));
    }else if(!CommonUtils.isSupportedAction(this.get('actionType')) && this.get('actionModel.slaInfo')){
      this.set('customSlaInfo',  this.get('actionModel.slaInfo'));
      this.set('customSlaEnabled', this.get('actionModel.slaEnabled'));
      delete this.get('actionModel').slaInfo;
      delete this.get('actionModel').slaEnabled;
    }
    if(this.get('actionModel.unsupportedProperties') && !Ember.isEmpty(Object.keys(this.get('actionModel.unsupportedProperties')))){
      this.set('containsUnsupportedProperties', true);
    }else{
      this.set('containsUnsupportedProperties', false);
    }
  }.on('init'),
  initialize : function(){
    this.$('#action_properties_dialog').modal({
      backdrop: 'static',
      keyboard: false
    });
    this.$('#action_properties_dialog').modal('show');
    this.$('#action_properties_dialog').modal().on('hidden.bs.modal', function() {
      this.sendAction('closeActionEditor', this.get('saveClicked'));
    }.bind(this));
    this.get('fileBrowser').on('fileBrowserOpened',function(context){
      this.get('fileBrowser').setContext(context);
    }.bind(this));
    this.on('fileSelected',function(fileName){
      this.set(this.get('filePathModel'), fileName);
    }.bind(this));
  }.on('didInsertElement'),
  observeError :function(){
    if(this.$('#collapseOne label.text-danger').length > 0 && !this.$('#collapseOne').hasClass("in")){
      this.$('#collapseOne').collapse('show');
    }
  }.on('didUpdate'),
  validateChildrenComponents(){
    var isChildComponentsValid = true;
    this.get('childComponents').forEach((context)=>{
      if(context.get('validations') && context.get('validations.isInvalid')){
        isChildComponentsValid =  false;
        context.set('showErrorMessage', true);
      }
    }.bind(this));
    return isChildComponentsValid;
  },
  processMultivaluedComponents(){
    this.get('childComponents').forEach((childComponent)=>{
      if(childComponent.get('multivalued')){
        childComponent.trigger('bindInputPlaceholder');
      }
    });
  },
  processStaticProps(){
    this.get('childComponents').forEach((childComponent)=>{
      if(childComponent.get('hasStaticProps')){
        childComponent.get('staticProps').forEach((property)=>{
          this.get(property.belongsTo).push({name:property.name,value:property.value});
        });
      }
    });
  },
  actions : {
    closeEditor (){
      this.sendAction('close');
    },
    save () {
      var isChildComponentsValid = this.validateChildrenComponents();
      if(this.get('validations.isInvalid') || !isChildComponentsValid || this.get('errors').length > 0) {
        this.set('showErrorMessage', true);
        return;
      }
      if(!CommonUtils.isSupportedAction(this.get('actionType'))){
        this.set('actionModel.slaInfo',  this.get('customSlaInfo'));
        this.set('actionModel.slaEnabled', this.get('customSlaEnabled'));
      }
      this.processMultivaluedComponents();
      this.processStaticProps();
      this.$('#action_properties_dialog').modal('hide');
      this.sendAction('setNodeTransitions', this.get('transition'));
      this.set('saveClicked', true);
    },
    openFileBrowser(model, context){
      if(!context){
        context = this;
      }
      this.get('fileBrowser').trigger('fileBrowserOpened',context);
      this.set('filePathModel', model);
      this.set('showingFileBrowser',true);
    },
    closeFileBrowser(){
      this.get('fileBrowser').getContext().trigger('fileSelected', this.get('filePath'));
      this.set("showingFileBrowser",false);
    },
    registerChild (name, context){
      this.get('childComponents').set(name, context);
    }
  }
});
