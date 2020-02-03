import chalk from 'chalk'
import inquirer from 'inquirer'
import { CloudBaseError } from '../../error'
import { successLog, errorLog } from '../../logger'
import { batchInvokeFunctions, invokeFunction } from '../../function'
import { ICommandContext } from '../command'

export async function invoke(ctx: ICommandContext, name: string) {
    const {
        envId,
        config: { functions },
        options
    } = ctx
    let isBatchInvoke = false

    // 不指定云函数名称，触发配置文件中的所有函数
    if (!name) {
        const { isBatch } = await inquirer.prompt({
            type: 'confirm',
            name: 'isBatch',
            message: '无云函数名称，是否需要触发配置文件中的全部云函数？',
            default: false
        })

        isBatchInvoke = isBatch

        if (!isBatchInvoke) {
            throw new CloudBaseError('请指定云函数名称！')
        }
    }

    let params
    const jsonStringParams = options.params
    if (jsonStringParams) {
        try {
            params = JSON.parse(jsonStringParams)
        } catch (e) {
            console.log(e)
            throw new CloudBaseError('jsonStringParams 参数不是正确的 JSON 字符串')
        }
    }

    if (isBatchInvoke) {
        return batchInvokeFunctions({
            envId,
            functions,
            log: true
        })
    }

    const func = functions.find(item => item.name === name)

    const configParams = func?.params ? func.params : undefined

    const result = await invokeFunction({
        envId,
        functionName: name,
        params: params || configParams
    })

    if (result.InvokeResult === 0) {
        successLog(`[${name}] 调用成功\n`)
    } else {
        errorLog(`[${name}] 调用失败\n`)
    }

    const ResMap = {
        Duration: '运行时间',
        MemUsage: '内存占用',
        BillDuration: '计费时间',
        FunctionRequestId: '请求 Id ',
        RetMsg: '返回结果',
        ErrMsg: '错误信息',
        Log: '调用日志'
    }

    const formatInfo = {
        ...result,
        Duration: Number(result.Duration).toFixed(2) + 'ms',
        MemUsage: Number(Number(result.MemUsage) / Math.pow(1024, 2)).toFixed(2) + 'MB',
        BillDuration: result.BillDuration + 'ms'
    }

    const logInfo = Object.keys(ResMap)
        .map(key => {
            if (key === 'Log') {
                return `${chalk.bold.cyan(ResMap[key])}：\n${formatInfo[key]}`
            } else if (result.InvokeResult === 0 && key === 'ErrMsg') {
                return false
            } else {
                return `${chalk.bold.cyan(ResMap[key])}：${formatInfo[key]}`
            }
        })
        .filter(item => item)
        .join('\n')
    console.log(logInfo)
}
