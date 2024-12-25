// 查询证书信息
async function searchCertificate() {
    const certificateId = document.getElementById('certificateId').value;
    if (!certificateId) {
        alert('请输入证件号码');
        return;
    }

    try {
        const response = await fetch(`/api/search?id=${certificateId}`);
        const data = await response.json();

        if (data.success) {
            displayResult(data.data);
        } else {
            alert(data.message || '未找到相关信息');
        }
    } catch (error) {
        console.error('查询失败:', error);
        alert('查询失败，请检查服务器是否正常运行');
    }
}

// 显示查询结果
function displayResult(data) {
    document.getElementById('result').style.display = 'block';
    document.getElementById('name').textContent = data.name;
    document.getElementById('gender').textContent = data.gender;
    document.getElementById('idType').textContent = data.idType;
    document.getElementById('idNumber').textContent = data.idNumber;
    document.getElementById('certNumber').textContent = data.certNumber;
}

// 处理文件上传
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('请选择要上传的Excel文件');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.success) {
            alert(result.message);
            fileInput.value = '';
        } else {
            alert(result.message || '文件上传失败');
        }
    } catch (error) {
        console.error('上传失败:', error);
        alert('文件上传失败，请检查服务器是否正常运行');
    }
}); 