(() => {
  const api = window.lunoStartup;
  document.getElementById('version').textContent = api?.version ?? '';
  api?.onState(state => {
    document.body.classList.toggle('error', !!state.error);
    document.getElementById('phase').textContent = state.phase || 'Opening your local studio…';
    document.getElementById('detail').textContent = state.error || 'Your work stays on this device.';
    document.getElementById('retry').hidden = !state.error;
  });
  document.getElementById('retry').addEventListener('click', () => api?.retry());
  document.getElementById('quit').addEventListener('click', () => api?.quit());
})();
