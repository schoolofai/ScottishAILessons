import { Node, mergeAttributes } from '@tiptap/core';

export interface MathOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    math: {
      /**
       * Insert a math formula
       */
      insertMath: (latex: string, html: string) => ReturnType;
    };
  }
}

export const Math = Node.create<MathOptions>({
  name: 'math',

  group: 'inline',

  inline: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: null,
        parseHTML: element => element.getAttribute('data-latex'),
        renderHTML: attributes => {
          if (!attributes.latex) {
            return {};
          }
          return {
            'data-latex': attributes.latex,
          };
        },
      },
      html: {
        default: null,
        parseHTML: element => element.innerHTML,
        renderHTML: () => {
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Since this is an atom node with a custom nodeView, we don't specify content
    // The actual rendering happens in addNodeView()
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'math-inline',
        'data-latex': node.attrs.latex,
        contenteditable: 'false',
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'math-inline';
      dom.setAttribute('data-latex', node.attrs.latex);
      dom.setAttribute('contenteditable', 'false');
      dom.innerHTML = node.attrs.html;
      return {
        dom,
      };
    };
  },

  addCommands() {
    return {
      insertMath:
        (latex: string, html: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex,
              html,
            },
          });
        },
    };
  },
});
