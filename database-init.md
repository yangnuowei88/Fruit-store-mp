<!--
 * @Author: yangwei yangnuowei@126.com
 * @Date: 2025-11-02 18:06:17
 * @LastEditors: yangwei yangnuowei@126.com
 * @LastEditTime: 2025-11-02 18:11:43
 * @FilePath: \Fruit-store-mp\database-init.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
# 云数据库 user 表初始化

## 表结构设计

### user 集合字段说明

| 字段名 | 数据类型 | 描述 | 示例 |
|--------|----------|------|------|
| _id | String | 系统自动生成的唯一ID | auto-generated |
| openid | String | 微信用户唯一标识 | onKwC5ZT_bj3UX10GrLGW3y-o4cY |
| role | String | 用户角色：admin(管理员)、rider(骑手)、user(普通用户) | admin |
| name | String | 用户姓名 | 张三 |
| phone | String | 联系电话 | 13800138000 |
| status | String | 用户状态：active(激活)、inactive(停用) | active |
| createTime | Date | 创建时间 | 2024-01-01T00:00:00.000Z |
| updateTime | Date | 更新时间 | 2024-01-01T00:00:00.000Z |

## 角色权限说明

### admin (管理员)
- 可以看到所有按钮：后台管理、订单管理、骑手配送
- 拥有最高权限

### rider (骑手)
- 只能看到：骑手配送按钮
- 专门负责配送业务

### user (普通用户)
- 默认角色，无特殊权限按钮
- 只能使用基本功能

## 初始化数据

请在云开发控制台的数据库中创建 `user` 集合，并添加以下初始数据：

```json
[
  {
    "openid": "onKwC5ZT_bj3UX10GrLGW3y-o4cY",
    "role": "admin",
    "name": "系统管理员",
    "phone": "18611102686",
    "status": "active",
    "createTime": "2024-01-01T00:00:00.000Z",
    "updateTime": "2024-01-01T00:00:00.000Z"
  }
]
```

## 数据库权限设置

建议在云开发控制台中为 `user` 集合设置以下权限：

```json
{
  "read": true,
  "write": "auth.openid == resource.openid"
}
```

这样设置可以：
- 允许所有用户读取用户信息（用于角色判断）
- 只允许用户修改自己的信息