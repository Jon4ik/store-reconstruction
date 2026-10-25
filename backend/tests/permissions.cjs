// Run against the built backend: docker compose run --rm --no-deps -T backend node < backend/tests/permissions.cjs
const assert = require('node:assert/strict');
const { PermissionsGuard } = require('./dist/modules/auth/permissions.guard');
const { normalizePermissions, hasRight, allowedWorkTypes, toggleRight } = require('./dist/modules/auth/permission-model');
const { StoresService } = require('./dist/modules/stores/stores.service');
const { PERMISSIONS_KEY } = require('./dist/modules/auth/require-permissions.decorator');
let checks = 0;
function check(value) { assert.ok(value); checks++; }
async function main() {
  assert.deepEqual(normalizePermissions(['view','view_openings','edit','edit_openings','settings','import','manage_notifications']), ['view_openings','edit_openings','manage_ldap']); checks++;
  assert.deepEqual(allowedWorkTypes(['view_openings']), ['Открытие']); checks++;
  check(!hasRight(['settings'], 'manage_integrations'));
  check(!hasRight(['manage_roles'], 'manage_roles'));
  check(hasRight(['view_roles','manage_roles'], 'manage_roles'));
  assert.deepEqual(toggleRight([], 'edit_closures'), ['edit_closures','view_closures']); checks++;
  assert.deepEqual(toggleRight(['edit_closures','view_closures','view_openings'], 'view_closures'), ['view_openings']); checks++;
  const prisma = { storeProject: { findUnique: async ({where}) => ({workType: where.id === 'opening' ? 'Открытие' : 'Закрытие'}) }, comment: {findUnique: async () => ({storeId:'opening'})} };
  async function access(required, rights, params={}, body={}) {
    const guard = new PermissionsGuard({getAllAndOverride: () => required}, prisma);
    try { await guard.canActivate({getHandler(){},getClass(){},switchToHttp:()=>({getRequest:()=>({user:{permissions:rights},params,body})})}); return true; }
    catch (error) { if (error.getStatus?.() !== 403) throw error; return false; }
  }
  const closureEditor = ['view_closures','edit_closures','create_closures','delete_closures'];
  const openingViewer = ['view_openings'];
  check(await access(['store:edit'],closureEditor,{id:'closure'}));
  check(!await access(['store:edit'],closureEditor,{id:'opening'}));
  check(!await access(['store:delete'],closureEditor,{id:'opening'}));
  check(await access(['store:delete'],closureEditor,{id:'closure'}));
  check(!await access(['store:edit'],closureEditor,{id:'closure'},{workType:'Открытие'}));
  check(await access(['store:create'],closureEditor,{}, {workType:'Реконструкция'}));
  check(!await access(['store:create'],closureEditor,{}, {workType:'Открытие'}));
  check(await access(['store:view'],openingViewer,{id:'opening'}));
  check(!await access(['store:edit'],openingViewer,{id:'opening'}));
  check(!await access(['view_comments','store:view'],['view_comments','view_closures'],{id:'opening'}));
  check(!await access(['delete_comments','store:view'],['view_comments','delete_comments','view_closures'],{commentId:'comment'}));
  check(await access(['view_roles'],['view_roles']));
  check(!await access(['manage_roles'],['view_roles']));
  check(!await access([],closureEditor));
  check(await access(['lookup_shops'],closureEditor));
  check(!await access(['view_shops'],closureEditor));
  check(await access(['lookup_tus'],closureEditor));
  check(!await access(['view_tus'],closureEditor));
  let captured;
  const service = new StoresService({storeProject:{findMany:async args=>{captured=args;return []},count:async()=>0}});
  await service.findAll({workType:'Закрытие'}, openingViewer);
  assert.deepEqual(captured.where.workType, {in:['Открытие']}); checks++;
  assert.deepEqual(captured.where.AND, [{workType:'Закрытие'}]); checks++;
  let include;
  const single = new StoresService({storeProject:{findFirst:async args=>{include=args.include;return {id:'opening',storeNumber:'1',stageTasks:[]}}}});
  await single.findOne('opening',openingViewer); check(include.comments === false);
  await single.findOne('opening',[...openingViewer,'view_comments']); check(typeof include.comments === 'object');
  const {StoresController} = require('./dist/modules/stores/stores.controller');
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY,StoresController.prototype.create),['store:create']); checks++;
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY,StoresController.prototype.remove),['store:delete']); checks++;
  assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY,StoresController.prototype.restore),['store:delete']); checks++;
  console.log(`PASS: ${checks} permission checks (no database writes)`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
