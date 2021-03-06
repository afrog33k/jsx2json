const parser = require('@babel/parser');
const types = require('babel-types');
import traverse from 'babel-traverse';
import generate from 'babel-generator';

export function jsx2Json(jsx) {
    const options = {
        sourceType: 'module',
        plugins: ['jsx']
    };
    let JSXlevel = 0;
    let jsonTree;
    const ast = parser.parse(jsx, options);
    traverse(ast, {
        JSXElement: {
            enter: () => {
                JSXlevel++;
            },
            exit: () => {
                JSXlevel--;
            }
        },

        JSXOpeningElement: path => {
            const nodeName = path.node.name;
            let jsonNode;
            if (types.isJSXIdentifier(nodeName)) {
                const type = nodeName.name;
                jsonNode = {
                    type,
                };
            } else if (types.isJSXMemberExpression(nodeName)) {
                const type = nodeName.property.name;
                const parentType = getParentType(nodeName.object);
                jsonNode = {
                    type,
                    parentType,
                };
            }
            if (JSXlevel === 1) {
                jsonTree = jsonNode;
                path.parent.__jsonNode = jsonNode;
            } else if (JSXlevel > 1) {
                path.parent.__jsonNode = jsonNode;
                const parentJsonNode = path.parentPath.parentPath.node.__jsonNode;
                if (!parentJsonNode.children) {
                    parentJsonNode.children = [];
                }
                parentJsonNode.children.push(jsonNode);
            }
        },

        JSXText: path => {
            const text = path.node.value.replace(/[\n]/g, '').trim();
            if (text) {
                const parentNode = path.parent.__jsonNode;
                if (parentNode.type !== 'span') {
                    if (!parentNode.children) {
                        parentNode.children = [];
                    }
                    parentNode.children.push({
                        type: 'text',
                        text,
                    });
                } else {
                    parentNode.text = text;
                }
            }
        },

        JSXAttribute: path => {
            const node = path.node;
            const key = node.name.name;
            const value = getPropValue(node.value);
            const parent = path.findParent(path => {
                return types.isJSXElement(path.node)
            });
            const parentJsonNode = parent.node.__jsonNode;
            if (!parentJsonNode.props) {
                parentJsonNode.props = {};
            }
            parentJsonNode.props[key] = value;
        }
    });
    return jsonTree;
}

function getPropValue(node) {
    let value;
    if (types.isJSXExpressionContainer(node)) {
        const expression = node.expression;
        const code = generate(expression).code;
        value = eval(`(${code})`);
    } else {
        value = node.value;
    }
    return value;
}

function getParentType(node) {
    let type;
    if (types.isJSXIdentifier(node)) {
      type = node.name;
    } else if (types.isJSXMemberExpression(node)) {
      type = getParentType(node.object) + '.' + node.property.name;
    }
    return type;
}