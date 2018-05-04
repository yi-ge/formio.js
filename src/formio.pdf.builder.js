import { FormioFormBuilder } from "./formio.form.builder";
import FormioUtils from './utils';
import FormioPDF from './formio.pdf';

export class FormioPDFBuilder extends FormioFormBuilder {
  addDropZone() {
    if (this.dropZone) {
      return;
    }
    this.dropZone = this.ce('div');
    this.disableDropZone();
    this.pdfForm.prepend(this.dropZone);
    this.addEventListener(this.dropZone, 'dragover', (event) => {
      event.preventDefault();
      return false;
    });
    this.addEventListener(this.dropZone, 'drop', (event) => {
      event.preventDefault();
      this.dragStop(event);
      return false;
    });
  }

  get dropZoneStyles() {
    let iframeRect = FormioUtils.getElementRect(this.pdfForm.element);
    let iframeHeight = iframeRect ? iframeRect.height || 1000 : 1000;
    return `position:absolute;width: 100%;height:${iframeHeight}px;`;
  }

  render() {
    return this.onElement.then(() => {
      this.build();
      this.isBuilt = true;
      this.onResize();
      this.on('resetForm', () => this.reset(), true);
      this.on('refreshData', () => this.updateValue());
      setTimeout(() => {
        this.onChange();
        this.emit('render');
      }, 1);
    });
  }

  activateDropZone() {
    if (this.dropZone) {
      this.dropZone.setAttribute('style', this.dropZoneStyles + 'display:inherit;');
    }
  }

  disableDropZone() {
    if (this.dropZone) {
      this.dropZone.setAttribute('style', this.dropZoneStyles + 'display:none;');
    }
  }

  addComponentTo(parent, schema, element, sibling) {
    if (this.pdfForm && schema.overlay) {
      this.pdfForm.postMessage({name: 'addElement', data: schema});
    }
    return super.addComponentTo(parent, schema, element, sibling);
  }

  addComponent(component, element, data, before) {
    return super.addComponent(component, element, data, before, true);
  }

  updateComponent(component) {
    if (this.pdfForm && component.component) {
      this.pdfForm.postMessage({name: 'updateElement', data: component.component});
    }
    return super.updateComponent(component);
  }

  deleteComponent(component) {
    if (this.pdfForm && component.component) {
      this.pdfForm.postMessage({name: 'removeElement', data: component.component});
    }
    return super.deleteComponent(component);
  }

  dragStart(event, component) {
    event.dataTransfer.setData('text/plain', JSON.stringify(component.schema));
    this.activateDropZone();
  }

  // Do not clear the iframe.
  clear() {}
  redraw() {
    if (this.pdfForm) {
      this.pdfForm.postMessage({name: 'redraw'});
    }
  }

  dragStop(event, prevX, prevY) {
    event.preventDefault();
    let dropData = event.dataTransfer.getData('text/plain');
    if (!dropData || (typeof dropData !== 'string')) {
      return false;
    }

    let schema = JSON.parse(dropData);
    if (!schema) {
      return false;
    }

    schema.id = FormioUtils.getRandomComponentId();
    schema.overlay = {
      top: event.offsetY,
      left: event.offsetX,
      width: 100,
      height: 20
    };

    this.addComponentTo(this, schema, this.getContainer());
    this.disableDropZone();
    return false;
  }

  // Don't need to add a submit button here... the pdfForm will already do this.
  addSubmitButton() {}

  addBuilderComponent(component) {
    const builderComponent = super.addBuilderComponent(component);
    builderComponent.element.draggable = true;
    builderComponent.element.setAttribute('draggable', true);
    this.addEventListener(builderComponent.element, 'dragstart', (event) => this.dragStart(event, component));
  }

  refreshDraggable() {
    this.addSubmitButton();
    this.builderReadyResolve();
  }

  destroy() {
    super.destroy();
    _.each(this.groups, (group) => {
      _.each(group.components, (builderComponent) => {
        this.removeEventListener(builderComponent, 'dragstart');
      });
    });
  }

  build() {
    if (!this.pdfForm) {
      this.element.noDrop = true;
      this.pdfForm = new FormioPDF(this.element, this.options);
      this.pdfForm.on('iframe-elementUpdate', schema => {
        let component = this.getComponentById(schema.id);
        if (component && component.component) {
          component.component.overlay = {
            left: schema.left,
            top: schema.top,
            height: schema.height,
            width: schema.width
          };
          this.editComponent(component);
          this.emit('updateComponent', component);
        }
        return component;
      });
      this.pdfForm.on('iframe-componentUpdate', schema => {
        let component = this.getComponentById(schema.id);
        if (component && component.component) {
          component.component.overlay = {
            left: schema.overlay.left,
            top: schema.overlay.top,
            height: schema.overlay.height,
            width: schema.overlay.width
          };
          this.emit('updateComponent', component);
        }
        return component;
      });
      this.pdfForm.on('iframe-componentClick', schema => {
        let component = this.getComponentById(schema.id);
        if (component) {
          this.editComponent(component);
        }
      });
    }
    this.addComponents();
    this.addDropZone();
    this.updateDraggable();
    this.formReadyResolve();
  }

  setForm(form) {
    return super.setForm(form).then(() => {
      return this.ready.then(() => {
        if (this.pdfForm) {
          return this.pdfForm.setForm(form);
        }
        return form;
      });
    });
  }
}